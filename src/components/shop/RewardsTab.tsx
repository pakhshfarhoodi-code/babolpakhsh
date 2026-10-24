import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { formatPrice, formatPersianDate, toPersianDigits } from './shopUtils';
import {
  Gift,
  Award,
  Sparkles,
  Coins,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  History,
  Trophy,
  ArrowRight,
  Loader2,
  Package,
  TrendingUp,
} from 'lucide-react';

export interface LoyaltyHistoryItem {
  id: string;
  points: number;
  kind: 'earn' | 'reverse' | 'redeem' | 'refund' | 'adjust' | string;
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
  history: LoyaltyHistoryItem[];
  redemptions: LoyaltyRedemptionItem[];
  settings?: any;
}

export interface StoreRewardItem {
  id: string;
  title: string;
  description?: string | null;
  image_url?: string | null;
  quantity: number;
  consumer_value: number;
  points_price: number;
  stock?: number | null;
  per_store_monthly_limit?: number | null;
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

  // Toast / Floating Message
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = useCallback((text: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage((prev) => (prev?.text === text ? null : prev));
    }, 4500);
  }, []);

  // Fetch Loyalty Data & Rewards
  const fetchMyLoyalty = useCallback(async () => {
    if (!supabase) return;
    try {
      const { data, error } = await supabase.rpc('get_my_loyalty');
      if (!error && data) {
        setLoyaltyData({
          balance: Number(data.balance || 0),
          earned_total: Number(data.earned_total || 0),
          earned_30d: Number(data.earned_30d || 0),
          history: Array.isArray(data.history) ? data.history : [],
          redemptions: Array.isArray(data.redemptions) ? data.redemptions : [],
          settings: data.settings || {},
        });
      }
    } catch {
      // ignore
    }
  }, []);

  const fetchRewards = useCallback(async () => {
    if (!supabase) return;
    try {
      // SECURITY: Only query allowed columns (no purchase price, no visitor price, no cost)
      const { data, error } = await supabase
        .from('loyalty_rewards')
        .select('id, title, description, image_url, quantity, consumer_value, points_price, stock, per_store_monthly_limit')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (!error && data) {
        setRewards(data as StoreRewardItem[]);
      }
    } catch {
      // ignore
    }
  }, []);

  const fetchLeaderboard = useCallback(async (period: 'month' | 'all') => {
    if (!supabase) return;
    setLoadingLeaderboard(true);
    try {
      const { data, error } = await supabase.rpc('get_loyalty_leaderboard', {
        p_period: period,
      });
      if (!error && data) {
        setLeaderboardData({
          top: Array.isArray(data.top) ? data.top : [],
          me: data.me ?? null,
          total: Number(data.total || 0),
        });
      }
    } catch {
      // ignore
    } finally {
      setLoadingLeaderboard(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    let isMounted = true;
    const loadAll = async () => {
      setLoadingInitial(true);
      await Promise.all([fetchMyLoyalty(), fetchRewards(), fetchLeaderboard(leaderboardPeriod)]);
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
    fetchLeaderboard(period);
  };

  const balance = loyaltyData?.balance ?? 0;
  const earned30d = loyaltyData?.earned_30d ?? 0;

  // Sort rewards:
  // 1) First those that can be redeemed right now (balance >= points_price && in stock)
  // 2) Then the rest based on closest to being redeemed (least remaining points)
  const sortedRewards = useMemo(() => {
    const list = [...rewards];
    return list.sort((a, b) => {
      const aInStock = a.stock === null || a.stock === undefined || a.stock > 0;
      const bInStock = b.stock === null || b.stock === undefined || b.stock > 0;

      const aCanRedeem = balance >= a.points_price && aInStock;
      const bCanRedeem = balance >= b.points_price && bInStock;

      if (aCanRedeem && !bCanRedeem) return -1;
      if (!aCanRedeem && bCanRedeem) return 1;

      if (aCanRedeem && bCanRedeem) {
        return a.points_price - b.points_price;
      }

      // Neither can redeem: sort by gap (remaining points) ascending
      const aGap = Math.max(0, a.points_price - balance);
      const bGap = Math.max(0, b.points_price - balance);
      return aGap - bGap;
    });
  }, [rewards, balance]);

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
      <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
        <span className="text-xs sm:text-sm font-medium">در حال بارگذاری باشگاه و جوایز...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-slate-100 pb-12">
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
      {/* 1. TOP CARD: POINTS BALANCE                                     */}
      {/* ============================================================== */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/60 border border-emerald-500/30 p-6 shadow-xl">
        {/* Decorative background glow & shapes */}
        <div className="absolute -top-12 -left-12 w-40 h-40 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-10 -right-10 w-36 h-36 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                <Coins className="w-5 h-5" />
              </span>
              <span className="text-xs sm:text-sm font-bold text-slate-300">امتیاز شما</span>
            </div>

            {/* Big Bold Balance */}
            <div className="flex items-baseline gap-2 pt-1">
              <span className="text-3xl sm:text-4xl lg:text-5xl font-black text-white font-mono tracking-tight drop-shadow-sm">
                {toPersianDigits(balance.toLocaleString('fa-IR'))}
              </span>
              <span className="text-xs sm:text-sm font-bold text-amber-400">امتیاز وفاداری</span>
            </div>

            {/* 30 Days Earned Text */}
            <p className="text-xs text-slate-400 font-medium pt-1">
              ۳۰ روز اخیر:{' '}
              <span className="text-emerald-400 font-bold font-mono">
                {toPersianDigits(earned30d.toLocaleString('fa-IR'))}
              </span>{' '}
              امتیاز کسب کرده‌اید
            </p>
          </div>

          {/* Quick info chip */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-3.5 text-right space-y-1 w-full sm:w-auto">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Gift className="w-4 h-4 text-emerald-400" />
              <span>پاداش سفارش‌های تحویل‌شده</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              با هر فاکتور تحویل‌شده امتیاز بگیرید و با جوایز ارزنده تعویض کنید.
            </p>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 2. REWARDS CATALOG (2 COLUMNS ON MOBILE)                       */}
      {/* ============================================================== */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-amber-400" />
            <h3 className="text-sm sm:text-base font-black text-white">جوایز قابل دریافت</h3>
          </div>
          {rewards.length > 0 && (
            <span className="text-xs text-slate-400 font-mono">
              {toPersianDigits(rewards.length)} جایزه
            </span>
          )}
        </div>

        {rewards.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center space-y-2">
            <Gift className="w-10 h-10 text-slate-600 mx-auto" />
            <p className="text-sm font-bold text-slate-300">به‌زودی جوایز جدید اضافه می‌شود</p>
            <p className="text-xs text-slate-500">
              با ثبت سفارش‌های جدید امتیاز جمع‌آوری کنید تا هنگام فعال‌شدن جوایز آن‌ها را دریافت نمایید.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-4">
            {sortedRewards.map((reward) => {
              const inStock = reward.stock === null || reward.stock === undefined || reward.stock > 0;
              const isOutOfStock = reward.stock === 0;
              const canRedeem = balance >= reward.points_price && inStock;
              const gapPoints = Math.max(0, reward.points_price - balance);
              const progressRatio = Math.min(1, Math.max(0, balance / (reward.points_price || 1)));
              const progressPercent = Math.round(progressRatio * 100);

              return (
                <div
                  key={reward.id}
                  className={`bg-slate-900 border rounded-2xl sm:rounded-3xl p-3 sm:p-4 flex flex-col justify-between transition relative overflow-hidden shadow-sm ${
                    canRedeem
                      ? 'border-emerald-500/40 hover:border-emerald-500 shadow-emerald-500/5'
                      : 'border-slate-800/90'
                  }`}
                >
                  {/* Stock or Limit Badge */}
                  {isOutOfStock && (
                    <div className="absolute top-2 left-2 z-10 bg-rose-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-md">
                      تمام شد
                    </div>
                  )}

                  {reward.per_store_monthly_limit && !isOutOfStock && (
                    <div className="absolute top-2 left-2 z-10 bg-slate-950/80 text-slate-300 border border-slate-800 text-[9px] sm:text-[10px] font-medium px-2 py-0.5 rounded-full backdrop-blur-xs">
                      سقف {toPersianDigits(reward.per_store_monthly_limit)} بار در ماه
                    </div>
                  )}

                  <div>
                    {/* Big Image */}
                    <div className="relative aspect-square w-full rounded-xl sm:rounded-2xl overflow-hidden bg-slate-950 mb-3 border border-slate-800/60">
                      {reward.image_url ? (
                        <img
                          src={reward.image_url}
                          alt={reward.title}
                          className="w-full h-full object-cover"
                          loading="lazy"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 to-slate-950 text-amber-400/80">
                          <Gift className="w-10 h-10 sm:w-14 sm:h-14 stroke-1" />
                        </div>
                      )}
                    </div>

                    {/* Title */}
                    <h4 className="font-bold text-xs sm:text-sm text-white line-clamp-2 leading-snug mb-1">
                      {reward.title}
                    </h4>

                    {/* Bold Consumer Value (only if > 0) */}
                    {reward.consumer_value > 0 && (
                      <div className="text-[11px] sm:text-xs font-bold text-emerald-400 mb-1">
                        ارزش هدیه:{' '}
                        <span className="font-mono">
                          {toPersianDigits(reward.consumer_value.toLocaleString('fa-IR'))}
                        </span>{' '}
                        تومان
                      </div>
                    )}

                    {/* Points Price */}
                    <div className="flex items-center gap-1 text-amber-400 font-bold text-xs sm:text-sm mb-2.5">
                      <Coins className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                      <span className="font-mono">
                        {toPersianDigits(reward.points_price.toLocaleString('fa-IR'))}
                      </span>
                      <span className="text-[11px]">امتیاز</span>
                    </div>

                    {/* Progress Bar & Status Text */}
                    <div className="space-y-1 mb-3">
                      <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800/80">
                        <div
                          className={`h-full transition-all duration-500 rounded-full ${
                            canRedeem ? 'bg-emerald-500' : 'bg-amber-500'
                          }`}
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                      <div className="flex justify-between items-center text-[10px] text-slate-400">
                        {canRedeem ? (
                          <span className="text-emerald-400 font-bold">آماده دریافت!</span>
                        ) : (
                          <span>
                            {toPersianDigits(gapPoints.toLocaleString('fa-IR'))} امتیاز مانده
                          </span>
                        )}
                        <span className="font-mono text-slate-500">{toPersianDigits(progressPercent)}٪</span>
                      </div>
                    </div>
                  </div>

                  {/* Redeem Button */}
                  <button
                    type="button"
                    disabled={!canRedeem || isSubmittingRedeem}
                    onClick={() => setSelectedRewardToRedeem(reward)}
                    className={`w-full py-2 sm:py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                      canRedeem
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20 active:scale-98'
                        : isOutOfStock
                        ? 'bg-slate-950 text-slate-600 cursor-not-allowed border border-slate-800'
                        : 'bg-slate-800/70 text-slate-500 cursor-not-allowed'
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
      {/* 3. CONFIRMATION MODAL                                          */}
      {/* ============================================================== */}
      {selectedRewardToRedeem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl animate-in zoom-in-95 text-right">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
              <Gift className="w-7 h-7" />
            </div>

            <div className="text-center space-y-2">
              <h3 className="text-base font-bold text-white">تأیید درخواست دریافت هدیه</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                برای دریافت «<span className="text-white font-bold">{selectedRewardToRedeem.title}</span>» تعداد{' '}
                <span className="text-amber-400 font-bold font-mono">
                  {toPersianDigits(selectedRewardToRedeem.points_price.toLocaleString('fa-IR'))}
                </span>{' '}
                امتیاز کسر می‌شود. ادامه می‌دهید؟
              </p>
            </div>

            <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 text-xs space-y-1 text-slate-400">
              <div className="flex justify-between">
                <span>موجودی فعلی:</span>
                <span className="font-mono text-white font-bold">
                  {toPersianDigits(balance.toLocaleString('fa-IR'))}
                </span>
              </div>
              <div className="flex justify-between">
                <span>موجودی پس از کسر:</span>
                <span className="font-mono text-emerald-400 font-bold">
                  {toPersianDigits(Math.max(0, balance - selectedRewardToRedeem.points_price).toLocaleString('fa-IR'))}
                </span>
              </div>
            </div>

            <div className="space-y-2 pt-1">
              <button
                type="button"
                disabled={isSubmittingRedeem}
                onClick={handleConfirmRedeem}
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 transition cursor-pointer"
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
                className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition cursor-pointer"
              >
                انصراف
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 4. MY REDEMPTIONS (درخواست‌های من)                             */}
      {/* ============================================================== */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Package className="w-5 h-5 text-blue-400" />
          <h3 className="text-sm sm:text-base font-black text-white">درخواست‌های من</h3>
        </div>

        {(!loyaltyData?.redemptions || loyaltyData.redemptions.length === 0) ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-center text-xs text-slate-400">
            شما هنوز هیچ درخواستی برای دریافت جایزه ثبت نکرده‌اید.
          </div>
        ) : (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl divide-y divide-slate-800/80 overflow-hidden shadow-sm">
            {loyaltyData.redemptions.map((redemption) => {
              const isPending = redemption.status === 'pending';
              const isDelivered = redemption.status === 'delivered';
              const isCancelled = redemption.status === 'cancelled';

              return (
                <div key={redemption.id} className="p-3.5 sm:p-4 flex items-center justify-between gap-3 text-xs sm:text-sm">
                  <div className="space-y-1">
                    <h5 className="font-bold text-white line-clamp-1">{redemption.reward_title}</h5>
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                      <span>تعداد: {toPersianDigits(redemption.reward_qty || 1)}</span>
                      <span>•</span>
                      <span className="font-mono text-amber-400 font-bold">
                        {toPersianDigits(redemption.points_spent.toLocaleString('fa-IR'))} امتیاز
                      </span>
                      <span>•</span>
                      <span>{formatPersianDate(redemption.created_at, { includeTime: false })}</span>
                    </div>
                  </div>

                  {/* Status Chip */}
                  <div className="shrink-0">
                    {isPending && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                        <Clock className="w-3.5 h-3.5" />
                        <span>در انتظار تحویل</span>
                      </span>
                    )}
                    {isDelivered && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>تحویل شد</span>
                      </span>
                    )}
                    {isCancelled && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30">
                        <XCircle className="w-3.5 h-3.5" />
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
      {/* 5. LEADERBOARD (لیدربرد)                                        */}
      {/* ============================================================== */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-400" />
            <h3 className="text-sm sm:text-base font-black text-white">جدول برترین فروشگاه‌ها (لیدربرد)</h3>
          </div>

          {/* Period Toggle */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => handlePeriodChange('month')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                leaderboardPeriod === 'month'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
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
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              کل دوره
            </button>
          </div>
        </div>

        {loadingLeaderboard ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl py-8 flex items-center justify-center gap-2 text-xs text-slate-400">
            <Loader2 className="w-4 h-4 animate-spin text-emerald-500" />
            <span>در حال دریافت رتبه‌بندی...</span>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Top 10 List */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden divide-y divide-slate-800/70 shadow-sm">
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
                          ? 'bg-emerald-950/40 border-r-4 border-r-emerald-500'
                          : 'hover:bg-slate-800/30'
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
                            <span className="text-slate-400">{toPersianDigits(row.rank)}</span>
                          )}
                        </div>

                        {/* Name */}
                        <div className="flex items-center gap-2">
                          <span className={`font-bold ${row.is_me ? 'text-emerald-300' : 'text-slate-200'}`}>
                            {row.name}
                          </span>
                          {row.is_me && (
                            <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-bold px-1.5 py-0.2 rounded-md border border-emerald-500/30">
                              فروشگاه شما
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Points */}
                      <div className="font-mono font-bold text-amber-400 text-xs sm:text-sm">
                        {toPersianDigits(row.points.toLocaleString('fa-IR'))}
                        <span className="text-[10px] text-slate-400 mr-1 font-normal">امتیاز</span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-6 text-center text-xs text-slate-400">
                  اطلاعاتی برای این دوره ثبت نشده است.
                </div>
              )}
            </div>

            {/* If store is NOT in top 10 */}
            {leaderboardData && leaderboardData.me && !leaderboardData.top.some((t) => t.is_me) && (
              <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-2xl p-4 text-xs sm:text-sm flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-sm">
                <div className="flex items-center gap-2">
                  <span className="text-emerald-400 font-bold">رتبه‌ی شما:</span>
                  <span className="font-mono font-black text-white">
                    {toPersianDigits(leaderboardData.me.rank)}
                  </span>
                  <span className="text-slate-400">از {toPersianDigits(leaderboardData.total)} فروشگاه</span>
                </div>
                {leaderboardData.me.gap_to_next > 0 && (
                  <div className="text-slate-300">
                    فقط{' '}
                    <span className="font-mono font-bold text-amber-400">
                      {toPersianDigits(leaderboardData.me.gap_to_next.toLocaleString('fa-IR'))}
                    </span>{' '}
                    امتیاز تا رتبه‌ی بالاتر
                  </div>
                )}
              </div>
            )}

            {/* If me is null */}
            {leaderboardData && leaderboardData.me === null && (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-center text-xs text-slate-400">
                با اولین سفارش تحویل‌شده وارد لیدربرد می‌شوید.
              </div>
            )}
          </div>
        )}
      </div>

      {/* ============================================================== */}
      {/* 6. POINTS HISTORY (COLLAPSIBLE / ACCORDION)                    */}
      {/* ============================================================== */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <button
          type="button"
          onClick={() => setIsHistoryOpen((prev) => !prev)}
          className="w-full p-4 flex items-center justify-between text-right text-xs sm:text-sm font-bold text-slate-200 hover:text-white transition cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-slate-400" />
            <span>تاریخچه‌ی امتیازات</span>
            {loyaltyData?.history && loyaltyData.history.length > 0 && (
              <span className="bg-slate-800 text-slate-400 text-[10px] px-2 py-0.5 rounded-full font-mono">
                {toPersianDigits(loyaltyData.history.length)} رکورد
              </span>
            )}
          </div>
          {isHistoryOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </button>

        {isHistoryOpen && (
          <div className="border-t border-slate-800/80 divide-y divide-slate-800/60 max-h-96 overflow-y-auto">
            {(!loyaltyData?.history || loyaltyData.history.length === 0) ? (
              <div className="p-6 text-center text-xs text-slate-400">
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
                        <span className="font-bold text-white">{getHistoryKindLabel(record.kind)}</span>
                        {record.order_id && (
                          <span className="text-[10px] text-slate-400 font-mono">
                            سفارش {record.order_id}
                          </span>
                        )}
                      </div>
                      {record.note && (
                        <p className="text-[11px] text-slate-400 leading-snug line-clamp-1">{record.note}</p>
                      )}
                      <span className="text-[10px] text-slate-500 font-mono block">
                        {formatPersianDate(record.created_at, { includeTime: true })}
                      </span>
                    </div>

                    {/* Points Delta */}
                    <div
                      className={`font-mono font-bold text-xs sm:text-sm shrink-0 ${
                        isPositive ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {isPositive ? '+' : ''}
                      {toPersianDigits(record.points.toLocaleString('fa-IR'))}
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
