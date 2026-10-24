import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { supabase } from '../../lib/supabase';
import { Product } from '../../types';
import { formatPrice } from './helpers';
import { formatPersianDate } from '../../utils/dateUtils';
import {
  Gift,
  Settings,
  Coins,
  Award,
  Inbox,
  Store,
  Search,
  Filter,
  Save,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Plus,
  Edit2,
  Trash2,
  Clock,
  Check,
  AlertCircle,
  Loader2,
  TrendingUp,
  Percent,
  Sparkles,
  ArrowUpDown,
  FileText,
  DollarSign,
  Package,
  Layers,
  ChevronDown,
} from 'lucide-react';

export interface LoyaltySettings {
  enabled: boolean;
  redeem_enabled: boolean;
  toman_per_point: number;
  rate_small: number;
  rate_large: number;
  value_small: number;
  value_large: number;
  show_names: boolean;
}

export interface ProductPointRow {
  product_id: string;
  points: number;
  is_manual: boolean;
}

export interface LoyaltyReward {
  id: string;
  product_id?: string | null;
  title: string;
  description?: string | null;
  image_url?: string | null;
  quantity: number;
  consumer_value: number;
  points_price: number;
  stock?: number | null;
  per_store_monthly_limit?: number | null;
  sort_order: number;
  is_active: boolean;
}

export interface LoyaltyRedemption {
  id: string;
  supermarket_id: string;
  reward_id?: string | null;
  reward_title: string;
  reward_qty: number;
  points_spent: number;
  status: 'pending' | 'delivered' | 'cancelled';
  note?: string | null;
  created_at: string;
  delivered_at?: string | null;
}

export interface LoyaltyBalanceRow {
  supermarket_id: string;
  name: string;
  owner?: string | null;
  balance: number;
  earned_total: number;
  earned_30d: number;
}

type LoyaltySubTab = 'settings' | 'products' | 'rewards' | 'redemptions' | 'stores';

const DEFAULT_SETTINGS: LoyaltySettings = {
  enabled: true,
  redeem_enabled: true,
  toman_per_point: 1000,
  rate_small: 1.5,
  rate_large: 3.5,
  value_small: 200000,
  value_large: 5000000,
  show_names: true,
};

function parseRpcError(err: any, fallback: string): string {
  if (!err) return fallback;
  const msg = typeof err === 'string' ? err : err.message || err.details || '';
  if (
    msg.includes('FORBIDDEN') ||
    msg.includes('permission denied') ||
    err.code === '42501' ||
    msg.toLowerCase().includes('forbidden')
  ) {
    return 'دسترسی ندارید';
  }
  return msg || fallback;
}

export const LoyaltyTab: React.FC = () => {
  const { products, categories, supermarkets, orders, showToast } = useApp();

  const [activeSubTab, setActiveSubTab] = useState<LoyaltySubTab>('settings');

  // SubTab 1: Settings
  const [settings, setSettings] = useState<LoyaltySettings>(DEFAULT_SETTINGS);
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  // SubTab 2: Product Points
  const [productPointsMap, setProductPointsMap] = useState<Record<string, { points: number; is_manual: boolean }>>({});
  const [editedPointsMap, setEditedPointsMap] = useState<Record<string, number>>({});
  const [loadingPoints, setLoadingPoints] = useState(false);
  const [savingPoints, setSavingPoints] = useState(false);
  const [recalculatingPoints, setRecalculatingPoints] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [productCategoryFilter, setProductCategoryFilter] = useState<string>('all');
  const [showOnlyUnsetPoints, setShowOnlyUnsetPoints] = useState(false);

  // SubTab 3: Rewards
  const [rewards, setRewards] = useState<LoyaltyReward[]>([]);
  const [loadingRewards, setLoadingRewards] = useState(false);
  const [editingRewardModal, setEditingRewardModal] = useState<Partial<LoyaltyReward> | null>(null);
  const [savingReward, setSavingReward] = useState(false);
  const [deletingRewardId, setDeletingRewardId] = useState<string | null>(null);

  // SubTab 4: Redemptions
  const [redemptions, setRedemptions] = useState<LoyaltyRedemption[]>([]);
  const [loadingRedemptions, setLoadingRedemptions] = useState(false);
  const [redemptionStatusFilter, setRedemptionStatusFilter] = useState<'all' | 'pending' | 'delivered' | 'cancelled'>('pending');
  const [cancellingRedemption, setCancellingRedemption] = useState<{ id: string; title: string } | null>(null);
  const [cancelReasonNote, setCancelReasonNote] = useState('');
  const [actionInProgressRedemptionId, setActionInProgressRedemptionId] = useState<string | null>(null);

  // SubTab 5: Stores & Balances
  const [balances, setBalances] = useState<LoyaltyBalanceRow[]>([]);
  const [loadingBalances, setLoadingBalances] = useState(false);
  const [storeSearch, setStoreSearch] = useState('');
  const [storeSortBy, setStoreSortBy] = useState<'balance' | 'earned_30d' | 'earned_total'>('balance');
  const [adjustingStore, setAdjustingStore] = useState<LoyaltyBalanceRow | null>(null);
  const [adjustDelta, setAdjustDelta] = useState<number | ''>('');
  const [adjustNote, setAdjustNote] = useState('');
  const [submittingAdjust, setSubmittingAdjust] = useState(false);
  const [manualOrderIdInput, setManualOrderIdInput] = useState('');
  const [awardingOrder, setAwardingOrder] = useState(false);

  // Badge count for pending redemptions
  const pendingRedemptionsCount = useMemo(() => {
    return redemptions.filter((r) => r.status === 'pending').length;
  }, [redemptions]);

  // Map of supermarket by ID for quick lookup
  const supermarketMap = useMemo(() => {
    const map = new Map<string, string>();
    supermarkets.forEach((s) => map.set(s.id, s.name));
    return map;
  }, [supermarkets]);

  // Load Settings
  const fetchSettings = useCallback(async () => {
    if (!supabase) return;
    setLoadingSettings(true);
    try {
      const { data, error } = await supabase.rpc('get_loyalty_settings');
      if (error) {
        showToast(parseRpcError(error, 'خطا در بارگذاری تنظیمات باشگاه'), 'error');
      } else if (data) {
        setSettings({
          enabled: Boolean(data.enabled ?? DEFAULT_SETTINGS.enabled),
          redeem_enabled: Boolean(data.redeem_enabled ?? DEFAULT_SETTINGS.redeem_enabled),
          toman_per_point: Number(data.toman_per_point ?? DEFAULT_SETTINGS.toman_per_point),
          rate_small: Number(data.rate_small ?? DEFAULT_SETTINGS.rate_small),
          rate_large: Number(data.rate_large ?? DEFAULT_SETTINGS.rate_large),
          value_small: Number(data.value_small ?? DEFAULT_SETTINGS.value_small),
          value_large: Number(data.value_large ?? DEFAULT_SETTINGS.value_large),
          show_names: Boolean(data.show_names ?? DEFAULT_SETTINGS.show_names),
        });
      }
    } catch (err) {
      showToast('خطای شبکه در دریافت تنظیمات', 'error');
    } finally {
      setLoadingSettings(false);
    }
  }, [showToast]);

  // Save Settings
  const handleSaveSettings = async () => {
    if (!supabase) return;
    setSavingSettings(true);
    try {
      const { error } = await supabase.rpc('admin_set_loyalty_settings', {
        p_settings: settings,
      });
      if (error) {
        showToast(parseRpcError(error, 'ذخیره تنظیمات با خطا مواجه شد'), 'error');
      } else {
        showToast('تنظیمات باشگاه با موفقیت ذخیره شد', 'success');
      }
    } catch (err) {
      showToast('خطای شبکه در ذخیره تنظیمات', 'error');
    } finally {
      setSavingSettings(false);
    }
  };

  // Load Product Points
  const fetchProductPoints = useCallback(async () => {
    if (!supabase) return;
    setLoadingPoints(true);
    try {
      const { data, error } = await supabase.from('product_points').select('product_id, points, is_manual');
      if (error) {
        showToast(parseRpcError(error, 'خطا در دریافت امتیاز کالاها'), 'error');
      } else if (data) {
        const map: Record<string, { points: number; is_manual: boolean }> = {};
        data.forEach((row: any) => {
          map[row.product_id] = {
            points: Number(row.points || 0),
            is_manual: Boolean(row.is_manual),
          };
        });
        setProductPointsMap(map);
        setEditedPointsMap({});
      }
    } catch (err) {
      showToast('خطای شبکه در دریافت جدول امتیاز کالاها', 'error');
    } finally {
      setLoadingPoints(false);
    }
  }, [showToast]);

  // Recalculate Product Points Automatically
  const handleRecalculateProductPoints = async () => {
    if (!window.confirm('امتیاز کالاهایی که دستی تنظیم نکرده‌اید بازنویسی می‌شود. آیا ادامه می‌دهید؟')) {
      return;
    }
    if (!supabase) return;
    setRecalculatingPoints(true);
    try {
      const { data, error } = await supabase.rpc('admin_recalc_product_points');
      if (error) {
        showToast(parseRpcError(error, 'خطا در محاسبه خودکار امتیاز کالاها'), 'error');
      } else {
        const count = typeof data === 'number' ? data : 0;
        showToast(`محاسبه خودکار انجام شد (${count.toLocaleString('fa-IR')} کالا به‌روز شدند)`, 'success');
        await fetchProductPoints();
      }
    } catch (err) {
      showToast('خطای شبکه در محاسبه خودکار', 'error');
    } finally {
      setRecalculatingPoints(false);
    }
  };

  // Save Modified Product Points
  const handleSaveProductPoints = async () => {
    const changedProductIds = Object.keys(editedPointsMap);
    if (changedProductIds.length === 0) {
      showToast('هیچ تغییری برای ذخیره وجود ندارد', 'info');
      return;
    }

    if (!supabase) return;
    setSavingPoints(true);
    try {
      const p_items = changedProductIds.map((pid) => ({
        product_id: pid,
        points: editedPointsMap[pid],
      }));

      const { error } = await supabase.rpc('admin_set_product_points', { p_items });
      if (error) {
        showToast(parseRpcError(error, 'خطا در ذخیره امتیاز کالاها'), 'error');
      } else {
        showToast(`امتیاز ${changedProductIds.length.toLocaleString('fa-IR')} کالا با موفقیت ذخیره شد`, 'success');
        // Update local map
        setProductPointsMap((prev) => {
          const next = { ...prev };
          changedProductIds.forEach((pid) => {
            next[pid] = {
              points: editedPointsMap[pid],
              is_manual: true,
            };
          });
          return next;
        });
        setEditedPointsMap({});
      }
    } catch (err) {
      showToast('خطای شبکه در ذخیره امتیازات', 'error');
    } finally {
      setSavingPoints(false);
    }
  };

  // Load Rewards
  const fetchRewards = useCallback(async () => {
    if (!supabase) return;
    setLoadingRewards(true);
    try {
      const { data, error } = await supabase
        .from('loyalty_rewards')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false });

      if (error) {
        showToast(parseRpcError(error, 'خطا در بارگذاری فهرست جوایز'), 'error');
      } else if (data) {
        setRewards(data as LoyaltyReward[]);
      }
    } catch (err) {
      showToast('خطای شبکه در دریافت جوایز', 'error');
    } finally {
      setLoadingRewards(false);
    }
  }, [showToast]);

  // Save Reward (Insert or Update)
  const handleSaveReward = async () => {
    if (!editingRewardModal || !supabase) return;

    if (!editingRewardModal.title || editingRewardModal.title.trim() === '') {
      showToast('لطفاً عنوان جایزه را وارد کنید', 'error');
      return;
    }

    if (!editingRewardModal.points_price || editingRewardModal.points_price <= 0) {
      showToast('امتیاز مورد نیاز باید بزرگتر از صفر باشد', 'error');
      return;
    }

    setSavingReward(true);
    try {
      const payload: any = {
        title: editingRewardModal.title.trim(),
        description: editingRewardModal.description?.trim() || null,
        image_url: editingRewardModal.image_url?.trim() || null,
        product_id: editingRewardModal.product_id || null,
        quantity: Math.max(1, Number(editingRewardModal.quantity || 1)),
        consumer_value: Math.max(0, Number(editingRewardModal.consumer_value || 0)),
        points_price: Math.max(1, Number(editingRewardModal.points_price || 1)),
        stock: editingRewardModal.stock !== undefined && editingRewardModal.stock !== null && editingRewardModal.stock !== ('' as any)
          ? Number(editingRewardModal.stock)
          : null,
        per_store_monthly_limit: editingRewardModal.per_store_monthly_limit !== undefined &&
          editingRewardModal.per_store_monthly_limit !== null &&
          editingRewardModal.per_store_monthly_limit !== ('' as any)
          ? Number(editingRewardModal.per_store_monthly_limit)
          : null,
        sort_order: Number(editingRewardModal.sort_order || 0),
        is_active: editingRewardModal.is_active ?? true,
      };

      if (editingRewardModal.id) {
        // Update
        const { error } = await supabase.from('loyalty_rewards').update(payload).eq('id', editingRewardModal.id);
        if (error) {
          showToast(parseRpcError(error, 'خطا در ویرایش جایزه'), 'error');
        } else {
          showToast('جایزه با موفقیت ویرایش شد', 'success');
          setEditingRewardModal(null);
          await fetchRewards();
        }
      } else {
        // Insert
        const { error } = await supabase.from('loyalty_rewards').insert([payload]);
        if (error) {
          showToast(parseRpcError(error, 'خطا در ثبت جایزه جدید'), 'error');
        } else {
          showToast('جایزه جدید با موفقیت اضافه شد', 'success');
          setEditingRewardModal(null);
          await fetchRewards();
        }
      }
    } catch (err) {
      showToast('خطای شبکه در ذخیره جایزه', 'error');
    } finally {
      setSavingReward(false);
    }
  };

  // Toggle Reward is_active
  const handleToggleRewardActive = async (reward: LoyaltyReward) => {
    if (!supabase) return;
    const nextState = !reward.is_active;
    try {
      const { error } = await supabase
        .from('loyalty_rewards')
        .update({ is_active: nextState })
        .eq('id', reward.id);
      if (error) {
        showToast(parseRpcError(error, 'خطا در تغییر وضعیت جایزه'), 'error');
      } else {
        setRewards((prev) =>
          prev.map((r) => (r.id === reward.id ? { ...r, is_active: nextState } : r))
        );
        showToast(nextState ? 'جایزه فعال شد' : 'جایزه غیرفعال شد', 'info');
      }
    } catch (err) {
      showToast('خطای شبکه در به‌روزرسانی جایزه', 'error');
    }
  };

  // Delete Reward
  const handleDeleteReward = async (id: string) => {
    if (!window.confirm('آیا از حذف این جایزه اطمینان دارید؟')) return;
    if (!supabase) return;
    setDeletingRewardId(id);
    try {
      const { error } = await supabase.from('loyalty_rewards').delete().eq('id', id);
      if (error) {
        showToast(parseRpcError(error, 'خطا در حذف جایزه'), 'error');
      } else {
        showToast('جایزه با موفقیت حذف شد', 'success');
        setRewards((prev) => prev.filter((r) => r.id !== id));
      }
    } catch (err) {
      showToast('خطای شبکه در حذف جایزه', 'error');
    } finally {
      setDeletingRewardId(null);
    }
  };

  // Load Redemptions
  const fetchRedemptions = useCallback(async () => {
    if (!supabase) return;
    setLoadingRedemptions(true);
    try {
      const { data, error } = await supabase
        .from('loyalty_redemptions')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        showToast(parseRpcError(error, 'خطا در بارگذاری درخواست‌های جایزه'), 'error');
      } else if (data) {
        setRedemptions(data as LoyaltyRedemption[]);
      }
    } catch (err) {
      showToast('خطای شبکه در دریافت درخواست‌ها', 'error');
    } finally {
      setLoadingRedemptions(false);
    }
  }, [showToast]);

  // Mark Redemption Delivered
  const handleMarkDelivered = async (id: string) => {
    if (!supabase) return;
    setActionInProgressRedemptionId(id);
    try {
      const { error } = await supabase.rpc('admin_mark_redemption_delivered', { p_id: id });
      if (error) {
        showToast(parseRpcError(error, 'خطا در ثبت تحویل جایزه'), 'error');
      } else {
        showToast('درخواست جایزه به عنوان «تحویل شده» ثبت شد', 'success');
        await fetchRedemptions();
      }
    } catch (err) {
      showToast('خطای شبکه در ثبت تحویل', 'error');
    } finally {
      setActionInProgressRedemptionId(null);
    }
  };

  // Cancel Redemption
  const handleConfirmCancelRedemption = async () => {
    if (!cancellingRedemption || !supabase) return;
    if (!cancelReasonNote.trim()) {
      showToast('لطفاً دلیل لغو درخواست را وارد کنید', 'error');
      return;
    }
    setActionInProgressRedemptionId(cancellingRedemption.id);
    try {
      const { error } = await supabase.rpc('admin_cancel_redemption', {
        p_id: cancellingRedemption.id,
        p_note: cancelReasonNote.trim(),
      });
      if (error) {
        showToast(parseRpcError(error, 'خطا در لغو درخواست جایزه'), 'error');
      } else {
        showToast('درخواست جایزه لغو شد و امتیاز به حساب فروشگاه برگشت', 'success');
        setCancellingRedemption(null);
        setCancelReasonNote('');
        await fetchRedemptions();
      }
    } catch (err) {
      showToast('خطای شبکه در لغو درخواست', 'error');
    } finally {
      setActionInProgressRedemptionId(null);
    }
  };

  // Load Balances
  const fetchBalances = useCallback(async () => {
    if (!supabase) return;
    setLoadingBalances(true);
    try {
      const { data, error } = await supabase.rpc('admin_loyalty_balances');
      if (error) {
        showToast(parseRpcError(error, 'خطا در دریافت موجودی باشگاه فروشگاه‌ها'), 'error');
      } else if (data) {
        setBalances(data as LoyaltyBalanceRow[]);
      }
    } catch (err) {
      showToast('خطای شبکه در دریافت موجودی‌ها', 'error');
    } finally {
      setLoadingBalances(false);
    }
  }, [showToast]);

  // Adjust Store Points Manually
  const handleAdjustPointsSubmit = async () => {
    if (!adjustingStore || !supabase) return;
    if (adjustDelta === '' || adjustDelta === 0) {
      showToast('لطفاً مقدار تغییر امتیاز (مثبت یا منفی) را مشخص کنید', 'error');
      return;
    }
    if (!adjustNote.trim()) {
      showToast('وارد کردن یادداشت و علت تغییر الزامی است', 'error');
      return;
    }

    setSubmittingAdjust(true);
    try {
      const { error } = await supabase.rpc('admin_adjust_points', {
        p_store_id: adjustingStore.supermarket_id,
        p_delta: Number(adjustDelta),
        p_note: adjustNote.trim(),
      });
      if (error) {
        showToast(parseRpcError(error, 'خطا در اعمال تغییر دستی امتیاز'), 'error');
      } else {
        showToast(`امتیاز با موفقیت ${Number(adjustDelta) > 0 ? 'افزایش' : 'کاهش'} یافت`, 'success');
        setAdjustingStore(null);
        setAdjustDelta('');
        setAdjustNote('');
        await fetchBalances();
      }
    } catch (err) {
      showToast('خطای شبکه در اعمال تغییر امتیاز', 'error');
    } finally {
      setSubmittingAdjust(false);
    }
  };

  // Award Order Manually
  const handleAwardOrder = async () => {
    const orderId = manualOrderIdInput.trim();
    if (!orderId) {
      showToast('لطفاً کد یا شماره سفارش را وارد کنید', 'error');
      return;
    }
    if (!supabase) return;
    setAwardingOrder(true);
    try {
      const { error } = await supabase.rpc('admin_award_order', {
        p_order_id: orderId,
      });
      if (error) {
        showToast(parseRpcError(error, 'خطا در اعطای امتیاز سفارش'), 'error');
      } else {
        showToast('امتیاز سفارش با موفقیت محاسبه و به حساب فروشگاه منظور شد', 'success');
        setManualOrderIdInput('');
        await fetchBalances();
      }
    } catch (err) {
      showToast('خطای شبکه در اعطای امتیاز', 'error');
    } finally {
      setAwardingOrder(false);
    }
  };

  // Initial load when sub-tabs switch
  useEffect(() => {
    if (activeSubTab === 'settings') {
      fetchSettings();
    } else if (activeSubTab === 'products') {
      fetchSettings();
      fetchProductPoints();
    } else if (activeSubTab === 'rewards') {
      fetchSettings();
      fetchRewards();
    } else if (activeSubTab === 'redemptions') {
      fetchRedemptions();
    } else if (activeSubTab === 'stores') {
      fetchBalances();
    }
  }, [activeSubTab, fetchSettings, fetchProductPoints, fetchRewards, fetchRedemptions, fetchBalances]);

  // Also prefetch redemptions on initial mount so badge count works immediately
  useEffect(() => {
    fetchRedemptions();
  }, [fetchRedemptions]);

  // Filtered products list
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (productCategoryFilter !== 'all' && p.category_id !== productCategoryFilter) {
        return false;
      }
      if (productSearch.trim()) {
        const query = productSearch.trim().toLowerCase();
        const matchName = p.name.toLowerCase().includes(query);
        const matchBrand = p.brand?.toLowerCase().includes(query);
        if (!matchName && !matchBrand) return false;
      }
      if (showOnlyUnsetPoints) {
        const currentPoints = editedPointsMap[p.id] ?? productPointsMap[p.id]?.points ?? 0;
        if (currentPoints > 0) return false;
      }
      return true;
    });
  }, [products, productCategoryFilter, productSearch, showOnlyUnsetPoints, editedPointsMap, productPointsMap]);

  // Filtered redemptions list
  const filteredRedemptions = useMemo(() => {
    return redemptions.filter((r) => {
      if (redemptionStatusFilter === 'all') return true;
      return r.status === redemptionStatusFilter;
    });
  }, [redemptions, redemptionStatusFilter]);

  // Filtered & sorted balances list
  const filteredBalances = useMemo(() => {
    let list = balances.filter((b) => {
      if (!storeSearch.trim()) return true;
      const q = storeSearch.trim().toLowerCase();
      const matchName = b.name.toLowerCase().includes(q);
      const matchOwner = b.owner?.toLowerCase().includes(q);
      return matchName || matchOwner;
    });

    list = [...list].sort((a, b) => {
      if (storeSortBy === 'balance') return b.balance - a.balance;
      if (storeSortBy === 'earned_30d') return b.earned_30d - a.earned_30d;
      if (storeSortBy === 'earned_total') return b.earned_total - a.earned_total;
      return 0;
    });

    return list;
  }, [balances, storeSearch, storeSortBy]);

  // Formula-based suggested points calculation for a reward
  const calculateSuggestedPoints = (consumerVal: number): number => {
    const V = Math.max(0, consumerVal);
    const { rate_small, rate_large, value_small, value_large, toman_per_point } = settings;
    const denominator = Math.max(1, value_large - value_small);
    const clampedRatio = Math.max(0, Math.min(1, (V - value_small) / denominator));
    const r = rate_small + (rate_large - rate_small) * clampedRatio; // percent
    const tpp = toman_per_point > 0 ? toman_per_point : 1000;
    const rawPoints = V / ((r / 100) * tpp);
    return Math.max(5, Math.round(rawPoints / 5) * 5);
  };

  // Live indicators for reward form
  const rewardLiveIndicators = useMemo(() => {
    if (!editingRewardModal) return null;
    const V = Number(editingRewardModal.consumer_value || 0);
    const pts = Number(editingRewardModal.points_price || 0);
    const tpp = settings.toman_per_point > 0 ? settings.toman_per_point : 1000;

    let storeReturnPercent: number | null = null;
    if (pts > 0 && tpp > 0) {
      storeReturnPercent = (V / (pts * tpp)) * 100;
    }

    let distributorCostPercent: number | null = null;
    if (editingRewardModal.product_id && pts > 0 && tpp > 0) {
      const prod = products.find((p) => p.id === editingRewardModal.product_id);
      if (prod) {
        const visPrice = prod.visitor_price ?? prod.price;
        const pack = Math.max(1, prod.items_per_package || 1);
        const qty = Math.max(1, Number(editingRewardModal.quantity || 1));
        const actualCost = visPrice * pack * qty;
        distributorCostPercent = (actualCost / (pts * tpp)) * 100;
      }
    }

    const isOutOfRange =
      storeReturnPercent !== null &&
      (storeReturnPercent < settings.rate_small || storeReturnPercent > settings.rate_large);

    return {
      storeReturnPercent,
      distributorCostPercent,
      isOutOfRange,
    };
  }, [editingRewardModal, settings, products]);

  return (
    <div className="space-y-6 text-slate-100">
      {/* Top Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 shadow-inner">
            <Gift className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg sm:text-xl font-black text-white">باشگاه مشتریان و جوایز</h2>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                  settings.enabled
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    : 'bg-red-500/10 text-red-400 border-red-500/20'
                }`}
              >
                {settings.enabled ? 'باشگاه فعال است' : 'باشگاه غیرفعال است'}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              مدیریت پاداش خرید، امتیاز کالاها، کاتالوگ جوایز، درخواست‌های تحویل و امتیازدهی به فروشگاه‌ها
            </p>
          </div>
        </div>

        {/* Quick Summary Pill */}
        <div className="flex items-center gap-3 bg-slate-950/60 border border-slate-800/80 rounded-xl px-3 py-2 text-xs">
          <div className="text-right">
            <span className="text-slate-400 block text-[11px]">ارزش هر امتیاز</span>
            <span className="font-bold text-amber-400 font-mono">
              {formatPrice(settings.toman_per_point)} تومان
            </span>
          </div>
          <div className="h-6 w-px bg-slate-800" />
          <div className="text-right">
            <span className="text-slate-400 block text-[11px]">نرخ بازگشت پاداش</span>
            <span className="font-bold text-blue-400 font-mono">
              %{settings.rate_small.toLocaleString('fa-IR')} تا %{settings.rate_large.toLocaleString('fa-IR')}
            </span>
          </div>
        </div>
      </div>

      {/* Sub Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2 overflow-x-auto no-scrollbar">
        <button
          type="button"
          onClick={() => setActiveSubTab('settings')}
          className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-2 cursor-pointer shrink-0 ${
            activeSubTab === 'settings'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 border border-blue-500'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-transparent'
          }`}
        >
          <Settings className="w-4 h-4" />
          <span>تنظیمات</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('products')}
          className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-2 cursor-pointer shrink-0 ${
            activeSubTab === 'products'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 border border-blue-500'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-transparent'
          }`}
        >
          <Coins className="w-4 h-4" />
          <span>امتیاز کالاها</span>
          <span className="px-1.5 py-0.5 rounded-full text-xs font-mono bg-white/10 text-slate-300">
            {products.length.toLocaleString('fa-IR')}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('rewards')}
          className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-2 cursor-pointer shrink-0 ${
            activeSubTab === 'rewards'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 border border-blue-500'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-transparent'
          }`}
        >
          <Award className="w-4 h-4" />
          <span>جوایز</span>
          <span className="px-1.5 py-0.5 rounded-full text-xs font-mono bg-white/10 text-slate-300">
            {rewards.length.toLocaleString('fa-IR')}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('redemptions')}
          className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-2 cursor-pointer shrink-0 ${
            activeSubTab === 'redemptions'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 border border-blue-500'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-transparent'
          }`}
        >
          <Inbox className="w-4 h-4" />
          <span>درخواست‌ها</span>
          {pendingRedemptionsCount > 0 && (
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-400 text-slate-950 font-mono shadow-xs animate-pulse">
              {pendingRedemptionsCount.toLocaleString('fa-IR')} در انتظار
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('stores')}
          className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-2 cursor-pointer shrink-0 ${
            activeSubTab === 'stores'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 border border-blue-500'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-transparent'
          }`}
        >
          <Store className="w-4 h-4" />
          <span>فروشگاه‌ها</span>
          <span className="px-1.5 py-0.5 rounded-full text-xs font-mono bg-white/10 text-slate-300">
            {supermarkets.length.toLocaleString('fa-IR')}
          </span>
        </button>
      </div>

      {/* ============================================================== */}
      {/* 1. SUBTAB: SETTINGS                                            */}
      {/* ============================================================== */}
      {activeSubTab === 'settings' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-6">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Settings className="w-5 h-5 text-blue-400" />
                  <span>تنظیمات عمومی باشگاه وفاداری</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  پیکربندی کلیدهای عملکردی، نرخ‌های تبدیل امتیاز و فرمول‌های پیشنهاد جایزه
                </p>
              </div>

              <button
                type="button"
                onClick={handleSaveSettings}
                disabled={savingSettings || loadingSettings}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 cursor-pointer transition shadow-md shadow-blue-600/20"
              >
                {savingSettings ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                <span>ذخیره تغییرات</span>
              </button>
            </div>

            {loadingSettings ? (
              <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-400">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                <span className="text-sm">در حال دریافت تنظیمات باشگاه...</span>
              </div>
            ) : (
              <div className="space-y-8">
                {/* Switches Section */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Switch 1: Enabled */}
                  <div
                    onClick={() => setSettings((s) => ({ ...s, enabled: !s.enabled }))}
                    className={`p-4 rounded-xl border transition cursor-pointer select-none flex items-center justify-between ${
                      settings.enabled
                        ? 'bg-blue-950/20 border-blue-500/40'
                        : 'bg-slate-950/50 border-slate-800 opacity-70'
                    }`}
                  >
                    <div>
                      <span className="font-bold text-sm block text-white">فعال بودن باشگاه</span>
                      <span className="text-xs text-slate-400 mt-0.5 block">
                        امکان کسب امتیاز هنگام ثبت و تحویل سفارش‌ها
                      </span>
                    </div>
                    <div
                      className={`w-12 h-6 flex items-center rounded-full p-1 transition duration-300 ${
                        settings.enabled ? 'bg-blue-600 justify-end' : 'bg-slate-700 justify-start'
                      }`}
                    >
                      <div className="bg-white w-4 h-4 rounded-full shadow-md" />
                    </div>
                  </div>

                  {/* Switch 2: Redeem Enabled */}
                  <div
                    onClick={() => setSettings((s) => ({ ...s, redeem_enabled: !s.redeem_enabled }))}
                    className={`p-4 rounded-xl border transition cursor-pointer select-none flex items-center justify-between ${
                      settings.redeem_enabled
                        ? 'bg-blue-950/20 border-blue-500/40'
                        : 'bg-slate-950/50 border-slate-800 opacity-70'
                    }`}
                  >
                    <div>
                      <span className="font-bold text-sm block text-white">امکان دریافت جایزه</span>
                      <span className="text-xs text-slate-400 mt-0.5 block">
                        اجازه ثبت درخواست خرج امتیاز برای مشتریان
                      </span>
                    </div>
                    <div
                      className={`w-12 h-6 flex items-center rounded-full p-1 transition duration-300 ${
                        settings.redeem_enabled ? 'bg-blue-600 justify-end' : 'bg-slate-700 justify-start'
                      }`}
                    >
                      <div className="bg-white w-4 h-4 rounded-full shadow-md" />
                    </div>
                  </div>

                  {/* Switch 3: Show Names */}
                  <div
                    onClick={() => setSettings((s) => ({ ...s, show_names: !s.show_names }))}
                    className={`p-4 rounded-xl border transition cursor-pointer select-none flex items-center justify-between ${
                      settings.show_names
                        ? 'bg-blue-950/20 border-blue-500/40'
                        : 'bg-slate-950/50 border-slate-800 opacity-70'
                    }`}
                  >
                    <div>
                      <span className="font-bold text-sm block text-white">نمایش نام فروشگاه‌ها</span>
                      <span className="text-xs text-slate-400 mt-0.5 block">
                        نمایش نام کامل در لیدربرد و رتبه‌بندی عمومی
                      </span>
                    </div>
                    <div
                      className={`w-12 h-6 flex items-center rounded-full p-1 transition duration-300 ${
                        settings.show_names ? 'bg-blue-600 justify-end' : 'bg-slate-700 justify-start'
                      }`}
                    >
                      <div className="bg-white w-4 h-4 rounded-full shadow-md" />
                    </div>
                  </div>
                </div>

                {/* Numeric Settings */}
                <div className="space-y-4">
                  <h4 className="text-sm font-bold text-slate-300 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-amber-400" />
                    <span>پارامترهای محاسباتی و نرخ پاداش</span>
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {/* toman_per_point */}
                    <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-2">
                      <label className="text-xs font-bold text-slate-200 block">
                        ارزش ریالی مبنا (toman_per_point)
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          value={settings.toman_per_point}
                          onChange={(e) =>
                            setSettings((s) => ({ ...s, toman_per_point: Math.max(1, Number(e.target.value)) }))
                          }
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-hidden focus:border-blue-500"
                        />
                        <span className="absolute left-3 top-2.5 text-xs text-slate-400">تومان</span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        تومان به‌ازای هر امتیاز – فقط برای پیشنهاد خودکار و محاسبات پایه ارزش‌گذاری
                      </p>
                    </div>

                    {/* rate_small */}
                    <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-2">
                      <label className="text-xs font-bold text-slate-200 block">
                        درصد پاداش جوایز کوچک (rate_small)
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          step="0.1"
                          value={settings.rate_small}
                          onChange={(e) =>
                            setSettings((s) => ({ ...s, rate_small: Math.max(0.1, Number(e.target.value)) }))
                          }
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-hidden focus:border-blue-500"
                        />
                        <span className="absolute left-3 top-2.5 text-xs text-slate-400">درصد %</span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        درصد بازگشت ارزش برای جوایز با ارزش ریالی پایین (پیش‌فرض: ۱.۵٪)
                      </p>
                    </div>

                    {/* rate_large */}
                    <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-2">
                      <label className="text-xs font-bold text-slate-200 block">
                        درصد پاداش جوایز بزرگ (rate_large)
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          step="0.1"
                          value={settings.rate_large}
                          onChange={(e) =>
                            setSettings((s) => ({ ...s, rate_large: Math.max(0.1, Number(e.target.value)) }))
                          }
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-hidden focus:border-blue-500"
                        />
                        <span className="absolute left-3 top-2.5 text-xs text-slate-400">درصد %</span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        درصد بازگشت ارزش برای جوایز با ارزش ریالی بالا (پیش‌فرض: ۳.۵٪)
                      </p>
                    </div>

                    {/* value_small */}
                    <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-2">
                      <label className="text-xs font-bold text-slate-200 block">
                        کف ارزش ریالی جایزه (value_small)
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          value={settings.value_small}
                          onChange={(e) =>
                            setSettings((s) => ({ ...s, value_small: Math.max(0, Number(e.target.value)) }))
                          }
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-hidden focus:border-blue-500"
                        />
                        <span className="absolute left-3 top-2.5 text-xs text-slate-400">تومان</span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        آستانه پایین ارزش جایزه برای اعمال کمترین نرخ بازگشت (مثلاً ۲۰۰ هزار تومان)
                      </p>
                    </div>

                    {/* value_large */}
                    <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-2">
                      <label className="text-xs font-bold text-slate-200 block">
                        سقف ارزش ریالی جایزه (value_large)
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          value={settings.value_large}
                          onChange={(e) =>
                            setSettings((s) => ({ ...s, value_large: Math.max(0, Number(e.target.value)) }))
                          }
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-hidden focus:border-blue-500"
                        />
                        <span className="absolute left-3 top-2.5 text-xs text-slate-400">تومان</span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        آستانه بالای ارزش جایزه برای اعمال بیشترین نرخ بازگشت (مثلاً ۵ میلیون تومان)
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 2. SUBTAB: PRODUCT POINTS                                      */}
      {/* ============================================================== */}
      {activeSubTab === 'products' && (
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              {/* Search */}
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
                <input
                  type="text"
                  placeholder="جستجوی نام یا برند کالا..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pr-9 pl-3 py-2 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-hidden focus:border-blue-500"
                />
              </div>

              {/* Category Filter */}
              <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                <select
                  value={productCategoryFilter}
                  onChange={(e) => setProductCategoryFilter(e.target.value)}
                  className="bg-transparent text-xs text-slate-200 focus:outline-hidden cursor-pointer"
                >
                  <option value="all" className="bg-slate-900">همه دسته‌ها ({categories.length})</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id} className="bg-slate-900">
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Toggle Unset Only */}
              <button
                type="button"
                onClick={() => setShowOnlyUnsetPoints((prev) => !prev)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border ${
                  showOnlyUnsetPoints
                    ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>فقط کالاهای بدون امتیاز</span>
              </button>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={handleRecalculateProductPoints}
                disabled={recalculatingPoints || loadingPoints}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer transition border border-slate-700"
              >
                {recalculatingPoints ? <Loader2 className="w-4 h-4 animate-spin text-amber-400" /> : <Sparkles className="w-4 h-4 text-amber-400" />}
                <span>محاسبه خودکار از قیمت فعلی</span>
              </button>

              <button
                type="button"
                onClick={handleSaveProductPoints}
                disabled={savingPoints || Object.keys(editedPointsMap).length === 0}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 cursor-pointer transition shadow-md shadow-blue-600/20"
              >
                {savingPoints ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                <span>
                  ذخیره تغییرات {Object.keys(editedPointsMap).length > 0 ? `(${Object.keys(editedPointsMap).length.toLocaleString('fa-IR')})` : ''}
                </span>
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
            {loadingPoints ? (
              <div className="py-16 flex flex-col items-center justify-center gap-3 text-slate-400">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                <span className="text-sm">در حال دریافت امتیاز کالاها...</span>
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="py-16 text-center text-slate-400">
                کالایی با این شرایط یافت نشد
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right border-collapse text-xs sm:text-sm">
                  <thead>
                    <tr className="bg-slate-950/70 border-b border-slate-800 text-slate-400">
                      <th className="py-3 px-4 font-semibold">ردیف</th>
                      <th className="py-3 px-4 font-semibold">نام کالا</th>
                      <th className="py-3 px-4 font-semibold">دسته‌بندی</th>
                      <th className="py-3 px-4 font-semibold">تعداد در کارتن</th>
                      <th className="py-3 px-4 font-semibold">قیمت فروشگاه</th>
                      <th className="py-3 px-4 font-semibold">امتیاز هر واحد سفارش</th>
                      <th className="py-3 px-4 font-semibold">وضعیت تنظیم</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredProducts.map((p, idx) => {
                      const category = categories.find((c) => c.id === p.category_id);
                      const currentInfo = productPointsMap[p.id];
                      const isEdited = p.id in editedPointsMap;
                      const displayPoints = isEdited
                        ? editedPointsMap[p.id]
                        : currentInfo?.points ?? 0;
                      const isManual = currentInfo?.is_manual || isEdited;
                      const hasNoPoints = displayPoints === 0;

                      return (
                        <tr
                          key={p.id}
                          className={`hover:bg-slate-800/40 transition ${
                            hasNoPoints ? 'bg-amber-950/15' : isEdited ? 'bg-blue-950/20' : ''
                          }`}
                        >
                          <td className="py-3 px-4 text-slate-400 font-mono text-xs">
                            {(idx + 1).toLocaleString('fa-IR')}
                          </td>
                          <td className="py-3 px-4 font-medium text-white">
                            <div className="flex items-center gap-2">
                              {p.image_url ? (
                                <img
                                  src={p.image_url}
                                  alt={p.name}
                                  className="w-8 h-8 rounded-lg object-cover border border-slate-800 shrink-0"
                                  onError={(e) => {
                                    (e.target as HTMLElement).style.display = 'none';
                                  }}
                                />
                              ) : (
                                <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-slate-500 shrink-0">
                                  <Package className="w-4 h-4" />
                                </div>
                              )}
                              <div>
                                <span className="block">{p.name}</span>
                                {p.brand && <span className="text-[11px] text-slate-400">{p.brand}</span>}
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-slate-300">
                            {category?.name || '---'}
                          </td>
                          <td className="py-3 px-4 text-slate-300 font-mono">
                            {(p.items_per_package || 1).toLocaleString('fa-IR')}
                          </td>
                          <td className="py-3 px-4 font-mono font-medium text-slate-200">
                            {formatPrice(p.price)} تومان
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                min="0"
                                value={displayPoints}
                                onChange={(e) => {
                                  const val = Math.max(0, parseInt(e.target.value, 10) || 0);
                                  setEditedPointsMap((prev) => ({
                                    ...prev,
                                    [p.id]: val,
                                  }));
                                }}
                                className={`w-24 px-2.5 py-1.5 rounded-lg border text-sm font-mono text-center focus:outline-hidden transition ${
                                  hasNoPoints
                                    ? 'bg-amber-950/40 border-amber-500/50 text-amber-300 focus:border-amber-400'
                                    : isEdited
                                    ? 'bg-blue-950/40 border-blue-500 text-blue-200 focus:border-blue-400'
                                    : 'bg-slate-950 border-slate-700 text-white focus:border-blue-500'
                                }`}
                              />
                              <span className="text-xs text-slate-400">امتیاز</span>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            {hasNoPoints ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                <AlertTriangle className="w-3 h-3" />
                                <span>بدون امتیاز</span>
                              </span>
                            ) : isManual ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                <Check className="w-3 h-3" />
                                <span>تنظیم دستی</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                                <span>خودکار</span>
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 3. SUBTAB: REWARDS CATALOG                                     */}
      {/* ============================================================== */}
      {activeSubTab === 'rewards' && (
        <div className="space-y-4">
          {/* Header Action */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm flex items-center justify-between">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                <Award className="w-5 h-5 text-amber-400" />
                <span>کاتالوگ جوایز و هدایا</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                فهرست جوایزی که فروشگاه‌ها با کسب امتیاز می‌توانند درخواست دریافت دهند
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setEditingRewardModal({
                  title: '',
                  description: '',
                  image_url: '',
                  quantity: 1,
                  consumer_value: 0,
                  points_price: 100,
                  stock: null,
                  per_store_monthly_limit: null,
                  sort_order: rewards.length + 1,
                  is_active: true,
                });
              }}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 cursor-pointer transition shadow-md shadow-blue-600/20"
            >
              <Plus className="w-4 h-4" />
              <span>افزودن جایزه جدید</span>
            </button>
          </div>

          {/* Rewards Grid / Cards */}
          {loadingRewards ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl py-16 flex flex-col items-center justify-center gap-3 text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
              <span className="text-sm">در حال دریافت فهرست جوایز...</span>
            </div>
          ) : rewards.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400 space-y-3">
              <Award className="w-12 h-12 mx-auto text-slate-600" />
              <p className="text-sm font-bold text-slate-300">هیچ جایزه‌ای در کاتالوگ تعریف نشده است</p>
              <p className="text-xs text-slate-500">برای شروع، روی دکمه «افزودن جایزه جدید» کلیک کنید.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {rewards.map((reward) => {
                const linkedProduct = products.find((p) => p.id === reward.product_id);

                return (
                  <div
                    key={reward.id}
                    className={`bg-slate-900 border rounded-2xl p-5 shadow-sm transition flex flex-col justify-between ${
                      reward.is_active ? 'border-slate-800 hover:border-slate-700' : 'border-red-950/40 opacity-70 bg-slate-950/60'
                    }`}
                  >
                    <div>
                      {/* Top Header & Status */}
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex items-center gap-3">
                          {reward.image_url || linkedProduct?.image_url ? (
                            <img
                              src={reward.image_url || linkedProduct?.image_url || ''}
                              alt={reward.title}
                              className="w-14 h-14 rounded-xl object-cover border border-slate-800 shrink-0"
                              onError={(e) => {
                                (e.target as HTMLElement).style.display = 'none';
                              }}
                            />
                          ) : (
                            <div className="w-14 h-14 rounded-xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-center text-amber-400 shrink-0">
                              <Gift className="w-7 h-7" />
                            </div>
                          )}
                          <div>
                            <h4 className="text-sm font-bold text-white line-clamp-1">{reward.title}</h4>
                            {linkedProduct && (
                              <span className="text-[11px] text-blue-400 block line-clamp-1">
                                کالا: {linkedProduct.name}
                              </span>
                            )}
                            <span className="text-[11px] text-slate-400">
                              تعداد: {reward.quantity.toLocaleString('fa-IR')} عدد
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleToggleRewardActive(reward)}
                          title={reward.is_active ? 'غیرفعال کردن' : 'فعال کردن'}
                          className={`px-2 py-1 rounded-lg text-[11px] font-bold border transition cursor-pointer ${
                            reward.is_active
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              : 'bg-red-500/10 text-red-400 border-red-500/20'
                          }`}
                        >
                          {reward.is_active ? 'فعال' : 'غیرفعال'}
                        </button>
                      </div>

                      {reward.description && (
                        <p className="text-xs text-slate-400 line-clamp-2 mb-4 leading-relaxed">
                          {reward.description}
                        </p>
                      )}

                      {/* Specs Matrix */}
                      <div className="grid grid-cols-2 gap-2 bg-slate-950/60 border border-slate-800/80 rounded-xl p-3 text-xs mb-4">
                        <div>
                          <span className="text-slate-500 block text-[11px]">امتیاز مورد نیاز</span>
                          <span className="font-bold text-amber-400 font-mono text-sm">
                            {reward.points_price.toLocaleString('fa-IR')} امتیاز
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500 block text-[11px]">ارزش مصرف‌کننده</span>
                          <span className="font-bold text-slate-200 font-mono text-sm">
                            {formatPrice(reward.consumer_value)} ت
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500 block text-[11px]">موجودی انبار</span>
                          <span className="font-semibold text-slate-300 font-mono">
                            {reward.stock !== null && reward.stock !== undefined
                              ? `${reward.stock.toLocaleString('fa-IR')} عدد`
                              : 'نامحدود'}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500 block text-[11px]">سقف ماهانه فروشگاه</span>
                          <span className="font-semibold text-slate-300 font-mono">
                            {reward.per_store_monthly_limit !== null && reward.per_store_monthly_limit !== undefined
                              ? `${reward.per_store_monthly_limit.toLocaleString('fa-IR')} عدد`
                              : 'نامحدود'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-between pt-3 border-t border-slate-800/70">
                      <span className="text-[11px] text-slate-500 font-mono">
                        ترتیب: {(reward.sort_order || 0).toLocaleString('fa-IR')}
                      </span>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingRewardModal(reward)}
                          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-blue-400 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          <span>ویرایش</span>
                        </button>
                        <button
                          type="button"
                          disabled={deletingRewardId === reward.id}
                          onClick={() => handleDeleteReward(reward.id)}
                          className="p-1.5 bg-slate-800 hover:bg-red-500/20 text-red-400 rounded-lg text-xs transition cursor-pointer"
                        >
                          {deletingRewardId === reward.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Reward Create / Edit Modal */}
          {editingRewardModal && (
            <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-5 my-8 text-right">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Award className="w-5 h-5 text-amber-400" />
                    <span>{editingRewardModal.id ? 'ویرایش جایزه' : 'افزودن جایزه جدید'}</span>
                  </h3>
                  <button
                    type="button"
                    onClick={() => setEditingRewardModal(null)}
                    className="text-slate-400 hover:text-white cursor-pointer"
                  >
                    <XCircle className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
                  {/* Title */}
                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-1">
                      عنوان جایزه <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="مثال: ۲ کارتن روغن سرخ کردنی"
                      value={editingRewardModal.title || ''}
                      onChange={(e) =>
                        setEditingRewardModal((prev) => ({ ...prev, title: e.target.value }))
                      }
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-hidden focus:border-blue-500"
                    />
                  </div>

                  {/* Description */}
                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-1">توضیحات جایزه</label>
                    <textarea
                      rows={2}
                      placeholder="توضیحات تکمیلی یا شرایط تحویل..."
                      value={editingRewardModal.description || ''}
                      onChange={(e) =>
                        setEditingRewardModal((prev) => ({ ...prev, description: e.target.value }))
                      }
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-hidden focus:border-blue-500 resize-none"
                    />
                  </div>

                  {/* Linked Product & Quantity */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2">
                      <label className="text-xs font-bold text-slate-300 block mb-1">
                        انتخاب کالای مرتبط (اختیاری)
                      </label>
                      <select
                        value={editingRewardModal.product_id || ''}
                        onChange={(e) => {
                          const pid = e.target.value || null;
                          const prod = products.find((p) => p.id === pid);
                          const qty = editingRewardModal.quantity || 1;
                          let autoConsumerVal = editingRewardModal.consumer_value || 0;
                          if (prod) {
                            const cPrice = prod.consumer_price ?? prod.price;
                            const pack = Math.max(1, prod.items_per_package || 1);
                            autoConsumerVal = cPrice * pack * qty;
                          }
                          setEditingRewardModal((prev) => ({
                            ...prev,
                            product_id: pid,
                            consumer_value: autoConsumerVal,
                            title: prev?.title || prod?.name || '',
                            // Keep image_url null/empty unless already explicitly set by admin
                            image_url: prev?.image_url || '',
                          }));
                        }}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs sm:text-sm text-white focus:outline-hidden focus:border-blue-500"
                      >
                        <option value="">(بدون کالا - هدیه متفرقه/نقدی)</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} {p.brand ? `(${p.brand})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-300 block mb-1">تعداد واحد</label>
                      <input
                        type="number"
                        min="1"
                        value={editingRewardModal.quantity || 1}
                        onChange={(e) => {
                          const q = Math.max(1, parseInt(e.target.value, 10) || 1);
                          setEditingRewardModal((prev) => {
                            let nextVal = prev?.consumer_value || 0;
                            if (prev?.product_id) {
                              const prod = products.find((p) => p.id === prev.product_id);
                              if (prod) {
                                const cPrice = prod.consumer_price ?? prod.price;
                                const pack = Math.max(1, prod.items_per_package || 1);
                                nextVal = cPrice * pack * q;
                              }
                            }
                            return { ...prev, quantity: q, consumer_value: nextVal };
                          });
                        }}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white font-mono text-center focus:outline-hidden focus:border-blue-500"
                      />
                    </div>
                  </div>

                  {/* Reward Image with Live Store Preview & Fallback */}
                  {(() => {
                    const selectedProd = products.find((p) => p.id === editingRewardModal.product_id);
                    const customImg = (editingRewardModal.image_url || '').trim();
                    const catalogImg = (selectedProd?.image_url || '').trim();
                    const effectiveImg = customImg || catalogImg;
                    const isCustom = Boolean(customImg);

                    return (
                      <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 space-y-3">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-slate-300">
                            تصویر جایزه
                          </label>
                          {isCustom ? (
                            <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-blue-500/15 text-blue-400 border border-blue-500/30">
                              تصویر اختصاصی
                            </span>
                          ) : catalogImg ? (
                            <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                              از کاتالوگ
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-500 font-medium">
                              بدون تصویر (آیکون پیش‌فرض)
                            </span>
                          )}
                        </div>

                        {/* Live Preview */}
                        <div className="flex items-center gap-3">
                          <div className="w-16 h-16 rounded-xl bg-slate-900 border border-slate-800 overflow-hidden flex items-center justify-center shrink-0">
                            {effectiveImg ? (
                              <img
                                src={effectiveImg}
                                alt="پیش‌نمایش تصویر جایزه"
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  (e.target as HTMLElement).style.display = 'none';
                                }}
                              />
                            ) : (
                              <Gift className="w-8 h-8 text-amber-400/80 stroke-1" />
                            )}
                          </div>
                          <div className="text-xs text-slate-400 space-y-0.5">
                            <span className="text-white font-medium block">تصویری که فروشگاه می‌بیند</span>
                            <span className="text-[11px] text-slate-500 block leading-relaxed">
                              {isCustom
                                ? 'تصویر اختصاصی وارد شده نمایش داده می‌شود.'
                                : catalogImg
                                ? 'تصویر کاتالوگ کالای مرتبط نمایش داده می‌شود.'
                                : 'در صورت عدم بارگذاری تصویر، آیکون هدیه نمایش داده می‌شود.'}
                            </span>
                          </div>
                        </div>

                        {/* Custom URL Input & Reset Button */}
                        <div className="space-y-1.5 pt-1">
                          <div className="flex items-center justify-between">
                            <label className="text-[11px] font-bold text-slate-300">
                              آدرس تصویر اختصاصی جایزه (اختیاری)
                            </label>
                            {isCustom && catalogImg && (
                              <button
                                type="button"
                                onClick={() =>
                                  setEditingRewardModal((prev) => ({ ...prev, image_url: '' }))
                                }
                                className="text-[11px] text-emerald-400 hover:text-emerald-300 font-medium cursor-pointer underline"
                              >
                                بازگشت به تصویر کاتالوگ
                              </button>
                            )}
                          </div>
                          <input
                            type="text"
                            placeholder="https://... (در صورت خالی بودن، تصویر کاتالوگ استفاده می‌شود)"
                            value={editingRewardModal.image_url || ''}
                            onChange={(e) =>
                              setEditingRewardModal((prev) => ({ ...prev, image_url: e.target.value }))
                            }
                            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs sm:text-sm text-white focus:outline-hidden focus:border-blue-500 text-left font-mono placeholder:text-slate-600"
                          />
                        </div>
                      </div>
                    );
                  })()}

                  {/* Consumer Value & Points Price with Formula Button */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-950/70 border border-slate-800 p-4 rounded-xl">
                    <div>
                      <label className="text-xs font-bold text-slate-300 block mb-1">
                        ارزش مصرف‌کننده (تومان)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={editingRewardModal.consumer_value || 0}
                        onChange={(e) =>
                          setEditingRewardModal((prev) => ({
                            ...prev,
                            consumer_value: Math.max(0, parseInt(e.target.value, 10) || 0),
                          }))
                        }
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-hidden focus:border-blue-500"
                      />
                      <span className="text-[11px] text-slate-400 mt-1 block">
                        {formatPrice(editingRewardModal.consumer_value || 0)} تومان
                      </span>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-bold text-slate-300">امتیاز مورد نیاز</label>
                        <button
                          type="button"
                          onClick={() => {
                            const suggested = calculateSuggestedPoints(
                              editingRewardModal.consumer_value || 0
                            );
                            setEditingRewardModal((prev) => ({
                              ...prev,
                              points_price: suggested,
                            }));
                            showToast(`امتیاز پیشنهادی محاسبه شد: ${suggested.toLocaleString('fa-IR')}`, 'info');
                          }}
                          className="text-[11px] font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer"
                        >
                          <Sparkles className="w-3 h-3" />
                          <span>پیشنهاد فرمول</span>
                        </button>
                      </div>
                      <input
                        type="number"
                        min="1"
                        value={editingRewardModal.points_price || 0}
                        onChange={(e) =>
                          setEditingRewardModal((prev) => ({
                            ...prev,
                            points_price: Math.max(1, parseInt(e.target.value, 10) || 1),
                          }))
                        }
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-amber-400 font-mono font-bold focus:outline-hidden focus:border-blue-500"
                      />
                      <span className="text-[11px] text-slate-400 mt-1 block">
                        {(editingRewardModal.points_price || 0).toLocaleString('fa-IR')} امتیاز
                      </span>
                    </div>
                  </div>

                  {/* Live Indicators for Admin */}
                  {rewardLiveIndicators && (
                    <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-3.5 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400">درصد بازگشت به فروشگاه:</span>
                        <div className="flex items-center gap-1.5">
                          {rewardLiveIndicators.storeReturnPercent !== null ? (
                            <span
                              className={`font-mono font-bold ${
                                rewardLiveIndicators.isOutOfRange ? 'text-amber-400' : 'text-emerald-400'
                              }`}
                            >
                              %{rewardLiveIndicators.storeReturnPercent.toFixed(2)}
                            </span>
                          ) : (
                            <span className="text-slate-500">---</span>
                          )}
                          {rewardLiveIndicators.isOutOfRange && (
                            <span className="text-[10px] text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded">
                              خارج از بازه {settings.rate_small}٪ تا {settings.rate_large}٪
                            </span>
                          )}
                        </div>
                      </div>

                      {rewardLiveIndicators.distributorCostPercent !== null && (
                        <div className="flex items-center justify-between text-xs border-t border-slate-800/80 pt-2">
                          <span className="text-slate-400">هزینه واقعی برای شرکت پخش:</span>
                          <span className="font-mono font-bold text-blue-400">
                            %{rewardLiveIndicators.distributorCostPercent.toFixed(2)}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Stock, Limit, Sort, Active */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="text-xs font-bold text-slate-300 block mb-1">
                        موجودی انبار
                      </label>
                      <input
                        type="number"
                        placeholder="نامحدود"
                        value={
                          editingRewardModal.stock === null || editingRewardModal.stock === undefined
                            ? ''
                            : editingRewardModal.stock
                        }
                        onChange={(e) =>
                          setEditingRewardModal((prev) => ({
                            ...prev,
                            stock: e.target.value === '' ? null : parseInt(e.target.value, 10),
                          }))
                        }
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs sm:text-sm text-white font-mono focus:outline-hidden focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-300 block mb-1">
                        سقف ماهانه فروشگاه
                      </label>
                      <input
                        type="number"
                        placeholder="نامحدود"
                        value={
                          editingRewardModal.per_store_monthly_limit === null ||
                          editingRewardModal.per_store_monthly_limit === undefined
                            ? ''
                            : editingRewardModal.per_store_monthly_limit
                        }
                        onChange={(e) =>
                          setEditingRewardModal((prev) => ({
                            ...prev,
                            per_store_monthly_limit:
                              e.target.value === '' ? null : parseInt(e.target.value, 10),
                          }))
                        }
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs sm:text-sm text-white font-mono focus:outline-hidden focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-300 block mb-1">
                        ترتیب نمایش
                      </label>
                      <input
                        type="number"
                        value={editingRewardModal.sort_order ?? 0}
                        onChange={(e) =>
                          setEditingRewardModal((prev) => ({
                            ...prev,
                            sort_order: parseInt(e.target.value, 10) || 0,
                          }))
                        }
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs sm:text-sm text-white font-mono focus:outline-hidden focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-300 block mb-1">وضعیت</label>
                      <select
                        value={editingRewardModal.is_active ? 'true' : 'false'}
                        onChange={(e) =>
                          setEditingRewardModal((prev) => ({
                            ...prev,
                            is_active: e.target.value === 'true',
                          }))
                        }
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs sm:text-sm text-white focus:outline-hidden focus:border-blue-500"
                      >
                        <option value="true">فعال</option>
                        <option value="false">غیرفعال</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Footer Buttons */}
                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setEditingRewardModal(null)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer"
                  >
                    انصراف
                  </button>
                  <button
                    type="button"
                    disabled={savingReward}
                    onClick={handleSaveReward}
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-2 cursor-pointer shadow-md shadow-blue-600/20"
                  >
                    {savingReward ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    <span>{editingRewardModal.id ? 'ذخیره تغییرات' : 'ثبت جایزه'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* 4. SUBTAB: REDEMPTIONS                                         */}
      {/* ============================================================== */}
      {activeSubTab === 'redemptions' && (
        <div className="space-y-4">
          {/* Header & Filter Bar */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                <Inbox className="w-5 h-5 text-blue-400" />
                <span>درخواست‌های دریافت جایزه</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                فهرست جوایز درخواست‌شده توسط سوپرمارکت‌ها جهت تحویل با سفارشات
              </p>
            </div>

            {/* Status Segmented Filter */}
            <div className="flex items-center gap-1.5 p-1 bg-slate-950 border border-slate-800 rounded-xl overflow-x-auto">
              <button
                type="button"
                onClick={() => setRedemptionStatusFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  redemptionStatusFilter === 'all'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                همه ({redemptions.length})
              </button>
              <button
                type="button"
                onClick={() => setRedemptionStatusFilter('pending')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  redemptionStatusFilter === 'pending'
                    ? 'bg-amber-500 text-slate-950'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>در انتظار تایید</span>
                {pendingRedemptionsCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-950 text-amber-300 font-mono">
                    {pendingRedemptionsCount}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setRedemptionStatusFilter('delivered')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  redemptionStatusFilter === 'delivered'
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                تحویل‌شده
              </button>
              <button
                type="button"
                onClick={() => setRedemptionStatusFilter('cancelled')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  redemptionStatusFilter === 'cancelled'
                    ? 'bg-red-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                لغوشده
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
            {loadingRedemptions ? (
              <div className="py-16 flex flex-col items-center justify-center gap-3 text-slate-400">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                <span className="text-sm">در حال بارگذاری درخواست‌ها...</span>
              </div>
            ) : filteredRedemptions.length === 0 ? (
              <div className="py-16 text-center text-slate-400">
                درخواستی با این وضعیت یافت نشد
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right border-collapse text-xs sm:text-sm">
                  <thead>
                    <tr className="bg-slate-950/70 border-b border-slate-800 text-slate-400">
                      <th className="py-3 px-4 font-semibold">ردیف</th>
                      <th className="py-3 px-4 font-semibold">فروشگاه</th>
                      <th className="py-3 px-4 font-semibold">جایزه</th>
                      <th className="py-3 px-4 font-semibold">تعداد</th>
                      <th className="py-3 px-4 font-semibold">امتیاز مصرفی</th>
                      <th className="py-3 px-4 font-semibold">تاریخ ثبت</th>
                      <th className="py-3 px-4 font-semibold">وضعیت</th>
                      <th className="py-3 px-4 font-semibold">عملیات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredRedemptions.map((item, idx) => {
                      const storeName =
                        supermarketMap.get(item.supermarket_id) || item.supermarket_id;
                      const isPending = item.status === 'pending';
                      const isDelivered = item.status === 'delivered';
                      const isCancelled = item.status === 'cancelled';
                      const inProgress = actionInProgressRedemptionId === item.id;

                      return (
                        <tr key={item.id} className="hover:bg-slate-800/40 transition">
                          <td className="py-3 px-4 text-slate-400 font-mono text-xs">
                            {(idx + 1).toLocaleString('fa-IR')}
                          </td>
                          <td className="py-3 px-4 font-bold text-white">
                            <div className="flex items-center gap-2">
                              <Store className="w-4 h-4 text-slate-400 shrink-0" />
                              <span>{storeName}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 font-medium text-slate-200">
                            {item.reward_title}
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-300">
                            {item.reward_qty.toLocaleString('fa-IR')}
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-amber-400">
                            {item.points_spent.toLocaleString('fa-IR')} امتیاز
                          </td>
                          <td className="py-3 px-4 text-slate-300 font-mono text-xs">
                            {formatPersianDate(item.created_at, { includeTime: true })}
                          </td>
                          <td className="py-3 px-4">
                            {isPending && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                <Clock className="w-3 h-3" />
                                <span>در انتظار تایید</span>
                              </span>
                            )}
                            {isDelivered && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>تحویل شد</span>
                              </span>
                            )}
                            {isCancelled && (
                              <div className="space-y-0.5">
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-red-500/10 text-red-400 border border-red-500/20">
                                  <XCircle className="w-3 h-3" />
                                  <span>لغوشده</span>
                                </span>
                                {item.note && (
                                  <span className="block text-[10px] text-slate-400 max-w-xs truncate">
                                    علت: {item.note}
                                  </span>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            {isPending ? (
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  disabled={inProgress}
                                  onClick={() => handleMarkDelivered(item.id)}
                                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                                >
                                  {inProgress ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <Check className="w-3.5 h-3.5" />
                                  )}
                                  <span>تحویل شد</span>
                                </button>

                                <button
                                  type="button"
                                  disabled={inProgress}
                                  onClick={() =>
                                    setCancellingRedemption({
                                      id: item.id,
                                      title: `${item.reward_title} (${storeName})`,
                                    })
                                  }
                                  className="px-2.5 py-1.5 bg-slate-800 hover:bg-red-500/20 text-red-400 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                                >
                                  <XCircle className="w-3.5 h-3.5" />
                                  <span>لغو</span>
                                </button>
                              </div>
                            ) : (
                              <span className="text-xs text-slate-500">
                                {isDelivered && item.delivered_at
                                  ? formatPersianDate(item.delivered_at, { includeTime: false })
                                  : '---'}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Cancel Redemption Modal */}
          {cancellingRedemption && (
            <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 text-right">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2 text-red-400">
                    <XCircle className="w-5 h-5" />
                    <span>لغو درخواست جایزه</span>
                  </h4>
                  <button
                    type="button"
                    onClick={() => setCancellingRedemption(null)}
                    className="text-slate-400 hover:text-white cursor-pointer"
                  >
                    <XCircle className="w-5 h-5" />
                  </button>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">
                  آیا از لغو درخواست «{cancellingRedemption.title}» اطمینان دارید؟ امتیاز مصرفی به
                  موجودی فروشگاه بازگردانده خواهد شد.
                </p>

                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">
                    علت لغو (برای اطلاع مشتری) <span className="text-red-400">*</span>
                  </label>
                  <textarea
                    rows={3}
                    placeholder="مثال: اتمام موجودی در انبار یا عدم تأمین جایزه..."
                    value={cancelReasonNote}
                    onChange={(e) => setCancelReasonNote(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-hidden focus:border-red-500 resize-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setCancellingRedemption(null)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition cursor-pointer"
                  >
                    انصراف
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmCancelRedemption}
                    className="px-5 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-md shadow-red-600/20"
                  >
                    <span>تأیید لغو و عودت امتیاز</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* 5. SUBTAB: STORES & BALANCES                                   */}
      {/* ============================================================== */}
      {activeSubTab === 'stores' && (
        <div className="space-y-6">
          {/* Helper Box: Award Order */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-400" />
              <h4 className="text-sm font-bold text-white">محاسبه و اعطای امتیاز یک سفارش</h4>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              اگر سفارشی قبلاً تحویل شده ولی به هر دلیلی امتیاز آن محاسبه نشده است، شماره سفارش را وارد کنید تا امتیاز بر مبنای اقلام محاسبه و واریز شود.
            </p>

            <div className="flex flex-col sm:flex-row items-center gap-3 pt-1">
              <div className="relative w-full sm:w-80">
                <input
                  type="text"
                  placeholder="شناسه یا کد سفارش (Order ID)..."
                  value={manualOrderIdInput}
                  onChange={(e) => setManualOrderIdInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs sm:text-sm text-white font-mono focus:outline-hidden focus:border-blue-500"
                />
              </div>

              <button
                type="button"
                disabled={awardingOrder || !manualOrderIdInput.trim()}
                onClick={handleAwardOrder}
                className="w-full sm:w-auto px-5 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold rounded-xl text-xs sm:text-sm transition flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-amber-500/20"
              >
                {awardingOrder ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Coins className="w-4 h-4" />
                )}
                <span>اعطای امتیاز به سفارش</span>
              </button>
            </div>
          </div>

          {/* Controls Bar for Store Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
                <input
                  type="text"
                  placeholder="جستجوی نام فروشگاه یا مالک..."
                  value={storeSearch}
                  onChange={(e) => setStoreSearch(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pr-9 pl-3 py-2 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-hidden focus:border-blue-500"
                />
              </div>
            </div>

            {/* Sort Dropdown */}
            <div className="flex items-center gap-2">
              <ArrowUpDown className="w-4 h-4 text-slate-400" />
              <span className="text-xs text-slate-400">مرتب‌سازی:</span>
              <select
                value={storeSortBy}
                onChange={(e) => setStoreSortBy(e.target.value as any)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-hidden cursor-pointer"
              >
                <option value="balance">بیشترین موجودی فعلی</option>
                <option value="earned_30d">بیشترین امتیاز ۳۰ روز گذشته</option>
                <option value="earned_total">بیشترین مجموع امتیاز کسب‌شده</option>
              </select>
            </div>
          </div>

          {/* Stores Balances Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
            {loadingBalances ? (
              <div className="py-16 flex flex-col items-center justify-center gap-3 text-slate-400">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                <span className="text-sm">در حال دریافت موجودی فروشگاه‌ها...</span>
              </div>
            ) : filteredBalances.length === 0 ? (
              <div className="py-16 text-center text-slate-400">
                فروشگاهی یافت نشد
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right border-collapse text-xs sm:text-sm">
                  <thead>
                    <tr className="bg-slate-950/70 border-b border-slate-800 text-slate-400">
                      <th className="py-3 px-4 font-semibold">ردیف</th>
                      <th className="py-3 px-4 font-semibold">نام فروشگاه</th>
                      <th className="py-3 px-4 font-semibold">نام مالک</th>
                      <th className="py-3 px-4 font-semibold">موجودی فعلی</th>
                      <th className="py-3 px-4 font-semibold">۳۰ روز گذشته</th>
                      <th className="py-3 px-4 font-semibold">مجموع کسب‌شده</th>
                      <th className="py-3 px-4 font-semibold">عملیات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredBalances.map((store, idx) => (
                      <tr key={store.supermarket_id} className="hover:bg-slate-800/40 transition">
                        <td className="py-3 px-4 text-slate-400 font-mono text-xs">
                          {(idx + 1).toLocaleString('fa-IR')}
                        </td>
                        <td className="py-3 px-4 font-bold text-white">
                          <div className="flex items-center gap-2">
                            <Store className="w-4 h-4 text-slate-400 shrink-0" />
                            <span>{store.name}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-slate-300">
                          {store.owner || '---'}
                        </td>
                        <td className="py-3 px-4 font-mono font-black text-amber-400 text-sm">
                          {store.balance.toLocaleString('fa-IR')} امتیاز
                        </td>
                        <td className="py-3 px-4 font-mono font-medium text-emerald-400">
                          +{store.earned_30d.toLocaleString('fa-IR')}
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-300">
                          {store.earned_total.toLocaleString('fa-IR')}
                        </td>
                        <td className="py-3 px-4">
                          <button
                            type="button"
                            onClick={() => {
                              setAdjustingStore(store);
                              setAdjustDelta('');
                              setAdjustNote('');
                            }}
                            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-blue-400 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                          >
                            <Coins className="w-3.5 h-3.5" />
                            <span>تغییر دستی امتیاز</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Adjust Points Modal */}
          {adjustingStore && (
            <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 text-right">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <Coins className="w-5 h-5 text-amber-400" />
                    <span>تغییر دستی امتیاز فروشگاه</span>
                  </h4>
                  <button
                    type="button"
                    onClick={() => setAdjustingStore(null)}
                    className="text-slate-400 hover:text-white cursor-pointer"
                  >
                    <XCircle className="w-5 h-5" />
                  </button>
                </div>

                <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-400">فروشگاه:</span>
                    <span className="font-bold text-white">{adjustingStore.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">موجودی فعلی:</span>
                    <span className="font-mono font-bold text-amber-400">
                      {adjustingStore.balance.toLocaleString('fa-IR')} امتیاز
                    </span>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">
                    مقدار تغییر امتیاز (مثبت یا منفی) <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="number"
                    placeholder="مثال: 50 برای افزایش، -20 برای کسر"
                    value={adjustDelta}
                    onChange={(e) =>
                      setAdjustDelta(e.target.value === '' ? '' : parseInt(e.target.value, 10))
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white font-mono text-center focus:outline-hidden focus:border-blue-500"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    عدد مثبت برای پاداش و هدیه، عدد منفی برای کسر یا اصلاح اشتباه
                  </p>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">
                    علت تغییر (یادداشت الزامی) <span className="text-red-400">*</span>
                  </label>
                  <textarea
                    rows={2}
                    placeholder="مثال: پاداش جشنواره نوروزی / اصلاح خطای فاکتور..."
                    value={adjustNote}
                    onChange={(e) => setAdjustNote(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-hidden focus:border-blue-500 resize-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setAdjustingStore(null)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition cursor-pointer"
                  >
                    انصراف
                  </button>
                  <button
                    type="button"
                    disabled={submittingAdjust}
                    onClick={handleAdjustPointsSubmit}
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-md shadow-blue-600/20"
                  >
                    {submittingAdjust ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    <span>اعمال تغییر امتیاز</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
