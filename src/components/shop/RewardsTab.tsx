import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { supabase } from '../../lib/supabase';
import { formatPrice, formatPersianDate } from './shopUtils';
import {
  Gift,
  Award,
  Sparkles,
  Coins,
  Check,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  History,
  Trophy,
  Loader2,
  Package,
} from 'lucide-react';

export interface LoyaltyHistoryItem {
  id: string;
  points: number;
  kind: 'earn' | 'bonus' | 'reverse' | 'redeem' | 'refund' | 'adjust' | string;
  order_id?: string | null;
  note?: string | null;
  created_at: string;
}

export interface LoyaltyRedemptionItem {
  id: string;
  reward_title: string;
  reward_qty: number;
  points_spent: number;
  status: 'pending' | 'delivered' | 'cancelled' | string;
  created_at: string;
}

export interface MyLoyaltyData {
  balance: number;
  earned_total: number;
  earned_30d: number;
  unseen_bonus?: number;
  history: LoyaltyHistoryItem[];
  redemptions: LoyaltyRedemptionItem[];
  settings?: any;
}

export interface StoreRewardItem {
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
  sort_order?: number;
  created_at?: string;
  quantity_label?: string | null;
}

export interface LeaderboardRow {
  rank: number;
  name: string;
  points: number;
  is_me: boolean;
}

export interface LeaderboardData {
  top: LeaderboardRow[];
  me: {
    rank: number;
    points: number;
    gap_to_next: number;
  } | null;
  total: number;
  disabled?: boolean;
}

interface RewardsTabProps {
  onNavigateToCatalog?: () => void;
}

function parseRedeemError(err: any): string {
  if (!err) return 'خطا در ثبت درخواست جایزه';
  const raw = typeof err === 'string' ? err : err.message || err.details || '';
  if (raw.includes('INSUFFICIENT_POINTS')) return 'امتیاز کافی نیست';
  if (raw.includes('OUT_OF_STOCK')) return 'موجودی این جایزه تمام شده';
  if (raw.includes('MONTHLY_LIMIT')) return 'سقف دریافت ماهانه‌ی این جایزه پر شده';
  if (raw.includes('REWARD_UNAVAILABLE')) return 'این جایزه فعال نیست';
  if (raw.includes('REDEEM_DISABLED')) return 'دریافت جایزه موقتاً غیرفعال است';
  if (raw.includes('NOT_A_STORE')) return 'این بخش مخصوص فروشگاه‌هاست';
  return raw || 'خطا در ثبت درخواست جایزه';
}

function getHistoryKindLabel(kind: string): string {
  switch (kind) {
    case 'earn':
      return 'کسب امتیاز سفارش';
    case 'bonus':
      return 'پاداش عضویت';
    case 'reverse':
      return 'برگشت امتیاز';
    case 'redeem':
      return 'دریافت جایزه';
    case 'refund':
      return 'بازگشت امتیاز';
    case 'adjust':
      return 'اصلاح';
    default:
      return kind || 'تراکنش امتیاز';
  }
}

export const RewardsTab: React.FC<RewardsTabProps> = ({ onNavigateToCatalog }) => {
  const { products } = useApp();

  // Main Data States
  const [loyaltyData, setLoyaltyData] = useState<MyLoyaltyData | null>(null);
  const [rewards, setRewards] = useState<StoreRewardItem[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(true);

  // Leaderboard State
  const [leaderboardPeriod, setLeaderboardPeriod] = useState<'month' | 'all'>('month');
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardData | null>(null);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);

  // History Collapsible State
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  // Redeem Confirmation & Execution State
  const [selectedRewardToRedeem, setSelectedRewardToRedeem] = useState<StoreRewardItem | null>(null);
  const [isSubmittingRedeem, setIsSubmittingRedeem] = useState(false);

  // Broken image tracker for onError graceful fallback
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({});

  // Toast / Floating Message
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = useCallback((text: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage((prev) => (prev?.text === text ? null : prev));
    }, 4500);
  }, []);

  // Fetch Loyalty Data & Rewards
  const fetchLeaderboard = useCallback(async (period: 'month' | 'all') => {
    if (!supabase) return;
    setLoadingLeaderboard(true);
    try {
      const { data, error } = await supabase.rpc('get_loyalty_leaderboard', {
        p_period: period,
      });
      if (!error && data) {
        if (data.disabled === true) {
          setLeaderboardData({ top: [], me: null, total: 0, disabled: true });
        } else {
          setLeaderboardData({
            top: Array.isArray(data.top) ? data.top : [],
            me: data.me ?? null,
            total: Number(data.total || 0),
            disabled: Boolean(data.disabled),
          });
        }
      }
    } catch {
      // ignore
    } finally {
      setLoadingLeaderboard(false);
    }
  }, []);

  const fetchRewards = useCallback(async () => {
    if (!supabase) return;
    try {
      // SECURITY: Only query allowed columns (no purchase price, no visitor price, no cost)
      const { data, error } = await supabase
        .from('loyalty_rewards')
        .select('id, product_id, title, description, image_url, quantity, consumer_value, points_price, stock, per_store_monthly_limit, sort_order, created_at, quantity_label')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });

      if (!error && data) {
        setRewards(data as StoreRewardItem[]);
      }
    } catch {
      // ignore
    }
  }, []);

  const fetchMyLoyalty = useCallback(async () => {
    if (!supabase) return null;
    try {
      const { data, error } = await supabase.rpc('get_my_loyalty');
      if (!error && data) {
        const settingsObj = data.settings || {};
        setLoyaltyData({
          balance: Number(data.balance ?? 0),
          earned_total: Number(data.earned_total ?? 0),
          earned_30d: Number(data.earned_30d ?? 0),
          unseen_bonus: Number(data.unseen_bonus ?? 0),
          history: Array.isArray(data.history) ? data.history : [],
          redemptions: Array.isArray(data.redemptions) ? data.redemptions : [],
          settings: settingsObj,
        });
        return settingsObj;
      }
    } catch {
      // ignore
    }
    return null;
  }, []);

  // Initial load
  useEffect(() => {
    let isMounted = true;
    const loadAll = async () => {
      setLoadingInitial(true);
      const [settingsObj] = await Promise.all([fetchMyLoyalty(), fetchRewards()]);
      if (isMounted && settingsObj?.leaderboard_enabled !== false) {
        await fetchLeaderboard(leaderboardPeriod);
      }
      if (isMounted) {
        setLoadingInitial(false);
      }
    };
    loadAll();
    return () => {
      isMounted = false;
    };
  }, [fetchMyLoyalty, fetchRewards, fetchLeaderboard, leaderboardPeriod]);

  // When period changes
  const handlePeriodChange = (period: 'month' | 'all') => {
    setLeaderboardPeriod(period);
    if (loyaltyData?.settings?.leaderboard_enabled !== false) {
      fetchLeaderboard(period);
    }
  };

  const balance = Number(loyaltyData?.balance ?? 0);
  const earned30d = Number(loyaltyData?.earned_30d ?? 0);

  // Handle Redeem Confirmation
  const handleConfirmRedeem = async () => {
    if (!selectedRewardToRedeem || isSubmittingRedeem || !supabase) return;

    setIsSubmittingRedeem(true);
    try {
      const { data, error } = await supabase.rpc('redeem_reward', {
        p_reward_id: selectedRewardToRedeem.id,
      });

      if (error) {
        const errorMsg = parseRedeemError(error);
        showToast(errorMsg, 'error');
      } else {
        showToast('درخواست ثبت شد؛ هدیه همراه سفارش بعدی شما تحویل می‌شود', 'success');
        setSelectedRewardToRedeem(null);
        // Refresh balance and redemptions
        await Promise.all([fetchMyLoyalty(), fetchRewards()]);
      }
    } catch (err: any) {
      showToast(parseRedeemError(err), 'error');
    } finally {
      setIsSubmittingRedeem(false);
    }
  };

  if (loadingInitial) {
    return (
      <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-500">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
        <span className="text-xs sm:text-sm font-medium">در حال بارگذاری باشگاه و جوایز...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-slate-900 pb-12">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed top-4 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-md z-50 p-4 rounded-2xl shadow-2xl flex items-center gap-3 border text-xs sm:text-sm font-medium transition duration-300 animate-in slide-in-from-top-3 ${
            toastMessage.type === 'success'
              ? 'bg-emerald-950/95 border-emerald-500 text-emerald-200'
              : toastMessage.type === 'error'
              ? 'bg-rose-950/95 border-rose-500 text-rose-200'
              : 'bg-slate-900/95 border-slate-700 text-slate-200'
          }`}
        >
          {toastMessage.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          ) : toastMessage.type === 'error' ? (
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
          ) : (
            <Sparkles className="w-5 h-5 text-blue-400 shrink-0" />
          )}
          <span className="flex-1 leading-relaxed">{toastMessage.text}</span>
        </div>
      )}

      {/* ============================================================== */}
      {/* 1. TOP CARD: POINTS BALANCE (Rich Dark Emerald with bright text) */}
      {/* ============================================================== */}
      <div className="space-y-2.5">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-emerald-500 via-emerald-600 to-emerald-700 border border-emerald-400/30 p-3.5 sm:p-4.5 shadow-md shadow-emerald-600/20 text-white flex items-center justify-between gap-3">
          {/* Right side (RTL Start): Icon, Title, Subtitle, 30d info */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="p-1.5 rounded-xl bg-white/20 text-amber-300 border border-white/30 backdrop-blur-xs shrink-0">
                <Coins className="w-4 h-4 text-amber-300" />
              </span>
              <div className="min-w-0">
                <h3 className="text-xs sm:text-sm font-bold text-white leading-tight">امتیاز شما</h3>
                <span className="text-[10px] text-emerald-100 font-medium block">امتیاز وفاداری</span>
              </div>
            </div>

            <p className="text-[11px] sm:text-xs text-emerald-100 font-medium mt-1">
              ۳۰ روز اخیر:{' '}
              <span className="text-white font-bold font-mono">
                {earned30d.toLocaleString('fa-IR')}
              </span>{' '}
              امتیاز کسب کرده‌اید
            </p>
          </div>

          {/* Left side (RTL End): Big Balance display vertically centered */}
          <div className="flex flex-col items-end justify-center shrink-0">
            <div className="flex items-baseline gap-1">
              <span className="text-2xl sm:text-3xl md:text-4xl font-black text-white font-mono tracking-tight drop-shadow-[0_1.5px_3px_rgba(0,0,0,0.25)]">
                {balance.toLocaleString('fa-IR')}
              </span>
              <span className="text-[10px] sm:text-xs font-bold text-amber-200">امتیاز</span>
            </div>
          </div>
        </div>

        {/* Small explanatory info banner underneath card (not overlapping) */}
        <div className="bg-emerald-50/90 border border-emerald-200/90 rounded-2xl p-3 flex items-center gap-2.5 text-xs text-emerald-900 shadow-2xs">
          <Gift className="w-4 h-4 text-emerald-700 shrink-0" />
          <span className="leading-relaxed">
            <strong className="font-bold">پاداش سفارش‌های تحویل‌شده:</strong> با تحویل هر سفارش امتیاز بگیرید و آن را با جوایز ارزنده مبادله کنید. هدایا همراه با سفارش بعدی شما ارسال می‌شوند.
          </span>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 2. REWARDS CATALOG (2 COLUMNS ON MOBILE - LIGHT THEME)         */}
      {/* ============================================================== */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-amber-500" />
            <h3 className="text-sm sm:text-base font-black text-slate-900">جوایز قابل دریافت</h3>
          </div>
          {rewards.length > 0 && (
            <span className="text-xs text-slate-500 font-mono">
              {rewards.length.toLocaleString('fa-IR')} جایزه
            </span>
          )}
        </div>

        {rewards.length === 0 ? (
          <div className="bg-white border border-slate-200/90 rounded-3xl p-8 text-center space-y-2 shadow-xs">
            <Gift className="w-10 h-10 text-slate-400 mx-auto" />
            <p className="text-sm font-bold text-slate-700">به‌زودی جوایز جدید اضافه می‌شود</p>
            <p className="text-xs text-slate-500">
              با ثبت سفارش‌های جدید امتیاز جمع‌آوری کنید تا هنگام فعال‌شدن جوایز آن‌ها را دریافت نمایید.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-4">
            {rewards.map((reward) => {
              const inStock = reward.stock === null || reward.stock === undefined || reward.stock > 0;
              const isOutOfStock = reward.stock === 0;
              const canRedeem = balance >= reward.points_price && inStock;
              const gapPoints = Math.max(0, reward.points_price - balance);
              const progressRatio = Math.min(1, Math.max(0, balance / (reward.points_price || 1)));
              const progressPercent = Math.round(progressRatio * 100);

              // Image Fallback Rule:
              // reward.image_url || (product.image_url) || Gift icon
              const linkedProduct = products.find((p) => p.id === reward.product_id);
              const rewardImage = reward.image_url || linkedProduct?.image_url || null;
              const hasImageError = brokenImages[reward.id];

              return (
                <div
                  key={reward.id}
                  className={`bg-white border rounded-2xl sm:rounded-3xl p-3 sm:p-4 flex flex-col justify-between transition relative overflow-hidden shadow-xs hover:shadow-md ${
                    canRedeem
                      ? 'border-emerald-400 ring-1 ring-emerald-400/30'
                      : 'border-slate-200/90'
                  }`}
                >
                  {/* Badges on card top-right */}
                  <div className="absolute top-2 right-2 z-10 flex flex-col gap-1 items-end pointer-events-none">
                    {reward.per_store_monthly_limit && (
                      <div className="bg-slate-800 text-white text-[9px] sm:text-[10px] font-medium px-2 py-0.5 rounded-full shadow-xs">
                        سقف {reward.per_store_monthly_limit.toLocaleString('fa-IR')} بار در ماه
                      </div>
                    )}
                    {isOutOfStock ? (
                      <div className="bg-rose-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-xs">
                        تمام شد
                      </div>
                    ) : canRedeem ? (
                      <div className="bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-xs flex items-center gap-1">
                        <Check className="w-3 h-3 stroke-[2.5]" />
                        <span>قابل دریافت</span>
                      </div>
                    ) : null}
                  </div>

                  <div>
                    {/* Big Square Image */}
                    <div className="relative aspect-square w-full rounded-xl sm:rounded-2xl overflow-hidden bg-slate-50 border border-slate-200/80 mb-3 flex items-center justify-center">
                      {rewardImage && !hasImageError ? (
                        <img
                          src={rewardImage}
                          alt={reward.title}
                          className="w-full h-full object-cover"
                          loading="lazy"
                          onError={() => {
                            setBrokenImages((prev) => ({ ...prev, [reward.id]: true }));
                          }}
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center bg-emerald-50/70 text-emerald-600">
                          <Gift className="w-10 h-10 sm:w-12 sm:h-12 stroke-1" />
                        </div>
                      )}

                      {/* Quantity Label Badge on top-left of image */}
                      {reward.quantity_label && reward.quantity_label.trim() ? (
                        <span className="absolute top-2 left-2 z-10 px-1.5 py-0.5 rounded-md bg-slate-900/90 bg-indigo-500/15 text-indigo-300 font-bold border border-indigo-500/30 text-[11px] num-fa shadow-xs backdrop-blur-xs">
                          {reward.quantity_label.trim()}
                        </span>
                      ) : null}
                    </div>

                    {/* Title */}
                    <h4 className="font-bold text-xs sm:text-sm text-slate-900 line-clamp-2 leading-snug mb-1.5" title={reward.title}>
                      {reward.title}
                    </h4>

                    {/* Bold Consumer Value (only if > 0) */}
                    {reward.consumer_value > 0 && (
                      <div className="text-[11px] sm:text-xs font-bold text-emerald-700 mb-1.5">
                        ارزش هدیه:{' '}
                        <span className="font-mono font-black">
                          {formatPrice(reward.consumer_value)}
                        </span>
                      </div>
                    )}

                    {/* Points Price */}
                    <div className="flex items-center gap-1.5 text-amber-700 font-bold text-xs sm:text-sm mb-2.5">
                      <Coins className="w-4 h-4 text-amber-600 shrink-0" />
                      <span className="font-mono text-sm font-black">
                        {reward.points_price.toLocaleString('fa-IR')}
                      </span>
                      <span className="text-[11px] text-slate-600 font-normal">امتیاز</span>
                    </div>

                    {/* Progress Bar & Status Text */}
                    <div className="space-y-1 mb-3">
                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                        <div
                          className={`h-full transition-all duration-500 rounded-full ${
                            canRedeem ? 'bg-emerald-500' : 'bg-amber-500'
                          }`}
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                      <div className="flex justify-between items-center text-[10px] text-slate-600 font-medium">
                        {canRedeem ? (
                          <span className="text-emerald-700 font-bold">آماده دریافت!</span>
                        ) : (
                          <span>
                            {gapPoints.toLocaleString('fa-IR')} امتیاز مانده
                          </span>
                        )}
                        <span className="font-mono text-slate-500 font-bold">{progressPercent.toLocaleString('fa-IR')}٪</span>
                      </div>
                    </div>
                  </div>

                  {/* Redeem Button */}
                  <button
                    type="button"
                    disabled={!canRedeem || isSubmittingRedeem}
                    onClick={() => setSelectedRewardToRedeem(reward)}
                    className={`w-full py-2 sm:py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                      canRedeem
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20 active:scale-98 cursor-pointer'
                        : isOutOfStock
                        ? 'bg-slate-100 text-rose-500 cursor-not-allowed border border-rose-200'
                        : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                    }`}
                  >
                    {canRedeem ? (
                      <>
                        <Gift className="w-3.5 h-3.5" />
                        <span>دریافت جایزه</span>
                      </>
                    ) : isOutOfStock ? (
                      <span>موجودی تمام شد</span>
                    ) : (
                      <span>امتیاز کافی نیست</span>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ============================================================== */}
      {/* 3. CONFIRMATION MODAL (LIGHT THEME)                            */}
      {/* ============================================================== */}
      {selectedRewardToRedeem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl text-right text-slate-900 animate-in zoom-in-95">
            <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto">
              <Gift className="w-7 h-7" />
            </div>

            <div className="text-center space-y-2">
              <h3 className="text-base font-bold text-slate-900">تأیید درخواست دریافت هدیه</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                برای دریافت «<span className="text-slate-900 font-bold">{selectedRewardToRedeem.title}</span>» تعداد{' '}
                <span className="text-amber-700 font-bold font-mono">
                  {selectedRewardToRedeem.points_price.toLocaleString('fa-IR')}
                </span>{' '}
                امتیاز کسر می‌شود. ادامه می‌دهید؟
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs space-y-1.5 text-slate-600">
              <div className="flex justify-between items-center">
                <span>موجودی فعلی:</span>
                <span className="font-mono text-slate-900 font-bold text-sm">
                  {balance.toLocaleString('fa-IR')} امتیاز
                </span>
              </div>
              <div className="flex justify-between items-center pt-1 border-t border-slate-200">
                <span>موجودی پس از کسر:</span>
                <span className="font-mono text-emerald-700 font-bold text-sm">
                  {Math.max(0, balance - selectedRewardToRedeem.points_price).toLocaleString('fa-IR')} امتیاز
                </span>
              </div>
            </div>

            <div className="space-y-2 pt-1">
              <button
                type="button"
                disabled={isSubmittingRedeem}
                onClick={handleConfirmRedeem}
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/25 transition cursor-pointer"
              >
                {isSubmittingRedeem ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>در حال ثبت درخواست...</span>
                  </>
                ) : (
                  <span>تأیید و کسر امتیاز</span>
                )}
              </button>

              <button
                type="button"
                disabled={isSubmittingRedeem}
                onClick={() => setSelectedRewardToRedeem(null)}
                className="w-full py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium transition cursor-pointer"
              >
                انصراف
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 4. MY REDEMPTIONS (LIGHT THEME)                                */}
      {/* ============================================================== */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Package className="w-5 h-5 text-blue-600" />
          <h3 className="text-sm sm:text-base font-black text-slate-900">درخواست‌های من</h3>
        </div>

        {(!loyaltyData?.redemptions || loyaltyData.redemptions.length === 0) ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-5 text-center text-xs text-slate-500 shadow-xs">
            شما هنوز هیچ درخواستی برای دریافت جایزه ثبت نکرده‌اید.
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-2xl divide-y divide-slate-100 overflow-hidden shadow-xs">
            {loyaltyData.redemptions.map((redemption) => {
              const isPending = redemption.status === 'pending';
              const isDelivered = redemption.status === 'delivered';
              const isCancelled = redemption.status === 'cancelled';

              return (
                <div key={redemption.id} className="p-3.5 sm:p-4 flex items-center justify-between gap-3 text-xs sm:text-sm">
                  <div className="space-y-1">
                    <h5 className="font-bold text-slate-900 line-clamp-1">{redemption.reward_title}</h5>
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                      <span>تعداد: {redemption.reward_qty.toLocaleString('fa-IR')}</span>
                      <span>•</span>
                      <span className="font-mono text-amber-700 font-bold">
                        {redemption.points_spent.toLocaleString('fa-IR')} امتیاز
                      </span>
                      <span>•</span>
                      <span>{formatPersianDate(redemption.created_at, { includeTime: false })}</span>
                    </div>
                  </div>

                  {/* Status Chip */}
                  <div className="shrink-0">
                    {isPending && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                        <Clock className="w-3.5 h-3.5 text-amber-600" />
                        <span>در انتظار تحویل</span>
                      </span>
                    )}
                    {isDelivered && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>تحویل شد</span>
                      </span>
                    )}
                    {isCancelled && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-50 text-rose-800 border border-rose-200">
                        <XCircle className="w-3.5 h-3.5 text-rose-600" />
                        <span>لغو شد</span>
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ============================================================== */}
      {/* 5. LEADERBOARD (LIGHT THEME) - Conditioned on leaderboard_enabled */}
      {/* ============================================================== */}
      {loyaltyData?.settings?.leaderboard_enabled !== false && leaderboardData?.disabled !== true && (
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-500" />
              <h3 className="text-sm sm:text-base font-black text-slate-900">جدول برترین فروشگاه‌ها (لیدربرد)</h3>
            </div>

            {/* Period Toggle */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => handlePeriodChange('month')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  leaderboardPeriod === 'month'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                ۳۰ روز اخیر
              </button>
              <button
                type="button"
                onClick={() => handlePeriodChange('all')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  leaderboardPeriod === 'all'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                کل دوره
              </button>
            </div>
          </div>

          {loadingLeaderboard ? (
            <div className="bg-white border border-slate-200 rounded-2xl py-8 flex items-center justify-center gap-2 text-xs text-slate-500 shadow-xs">
              <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
              <span>در حال دریافت رتبه‌بندی...</span>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Top 10 List */}
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100 shadow-xs">
                {leaderboardData && leaderboardData.top.length > 0 ? (
                  leaderboardData.top.map((row) => {
                    const isTop1 = row.rank === 1;
                    const isTop2 = row.rank === 2;
                    const isTop3 = row.rank === 3;

                    return (
                      <div
                        key={row.rank}
                        className={`p-3 sm:p-3.5 flex items-center justify-between gap-3 text-xs sm:text-sm transition ${
                          row.is_me
                            ? 'bg-emerald-50/80 border-r-4 border-r-emerald-500'
                            : 'hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {/* Rank Badge / Medal */}
                          <div className="w-7 h-7 flex items-center justify-center font-mono font-bold text-xs shrink-0">
                            {isTop1 ? (
                              <span className="text-xl" title="رتبه ۱ - طلا">🥇</span>
                            ) : isTop2 ? (
                              <span className="text-xl" title="رتبه ۲ - نقره">🥈</span>
                            ) : isTop3 ? (
                              <span className="text-xl" title="رتبه ۳ - برنز">🥉</span>
                            ) : (
                              <span className="text-slate-500 font-bold">{row.rank.toLocaleString('fa-IR')}</span>
                            )}
                          </div>

                          {/* Name */}
                          <div className="flex items-center gap-2">
                            <span className={`font-bold ${row.is_me ? 'text-emerald-950 font-black' : 'text-slate-800'}`}>
                              {row.name}
                            </span>
                            {row.is_me && (
                              <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-1.5 py-0.2 rounded-md border border-emerald-300">
                                فروشگاه شما
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Points */}
                        <div className="font-mono font-bold text-amber-700 text-xs sm:text-sm">
                          {row.points.toLocaleString('fa-IR')}
                          <span className="text-[10px] text-slate-500 mr-1 font-normal">امتیاز</span>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="p-6 text-center text-xs text-slate-500">
                    اطلاعاتی برای این دوره ثبت نشده است.
                  </div>
                )}
              </div>

              {/* If store is NOT in top 10 */}
              {leaderboardData && leaderboardData.me && !leaderboardData.top.some((t) => t.is_me) && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-xs sm:text-sm flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-xs text-emerald-950">
                  <div className="flex items-center gap-2">
                    <span className="text-emerald-800 font-bold">رتبه‌ی شما:</span>
                    <span className="font-mono font-black text-emerald-950 text-sm">
                      {leaderboardData.me.rank.toLocaleString('fa-IR')}
                    </span>
                    <span className="text-emerald-700">از {leaderboardData.total.toLocaleString('fa-IR')} فروشگاه</span>
                  </div>
                  {leaderboardData.me.gap_to_next > 0 && (
                    <div className="text-emerald-900 font-medium">
                      فقط{' '}
                      <span className="font-mono font-bold text-amber-700 text-sm">
                        {leaderboardData.me.gap_to_next.toLocaleString('fa-IR')}
                      </span>{' '}
                      امتیاز تا رتبه‌ی بالاتر
                    </div>
                  )}
                </div>
              )}

              {/* If me is null */}
              {leaderboardData && leaderboardData.me === null && (
                <div className="bg-white border border-slate-200 rounded-2xl p-4 text-center text-xs text-slate-500 shadow-xs">
                  با اولین سفارش تحویل‌شده وارد لیدربرد می‌شوید.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* 6. POINTS HISTORY (COLLAPSIBLE / ACCORDION - LIGHT THEME)      */}
      {/* ============================================================== */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
        <button
          type="button"
          onClick={() => setIsHistoryOpen((prev) => !prev)}
          className="w-full p-4 flex items-center justify-between text-right text-xs sm:text-sm font-bold text-slate-800 hover:bg-slate-50 transition cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-slate-500" />
            <span>تاریخچه‌ی امتیازات</span>
            {loyaltyData?.history && loyaltyData.history.length > 0 && (
              <span className="bg-slate-100 text-slate-600 text-[10px] px-2 py-0.5 rounded-full font-mono border border-slate-200">
                {loyaltyData.history.length.toLocaleString('fa-IR')} تراکنش
              </span>
            )}
          </div>
          {isHistoryOpen ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
        </button>

        {isHistoryOpen && (
          <div className="border-t border-slate-100 divide-y divide-slate-100 max-h-96 overflow-y-auto">
            {(!loyaltyData?.history || loyaltyData.history.length === 0) ? (
              <div className="p-6 text-center text-xs text-slate-500">
                هنوز تراکنشی در تاریخچه‌ی امتیازات ثبت نشده است.
              </div>
            ) : (
              loyaltyData.history.slice(0, 50).map((record) => {
                const isPositive = record.points > 0;
                return (
                  <div
                    key={record.id}
                    className="p-3 sm:p-3.5 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900">{getHistoryKindLabel(record.kind)}</span>
                        {record.order_id && (
                          <span className="text-[10px] text-slate-500 font-mono">
                            سفارش {record.order_id}
                          </span>
                        )}
                      </div>
                      {record.note && (
                        <p className="text-[11px] text-slate-600 leading-snug line-clamp-1">{record.note}</p>
                      )}
                      <span className="text-[10px] text-slate-400 font-mono block">
                        {formatPersianDate(record.created_at, { includeTime: true })}
                      </span>
                    </div>

                    {/* Points Delta */}
                    <div
                      className={`font-mono font-bold text-xs sm:text-sm shrink-0 ${
                        isPositive ? 'text-emerald-700' : 'text-rose-600'
                      }`}
                    >
                      {isPositive ? '+' : ''}
                      {record.points.toLocaleString('fa-IR')}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
};
