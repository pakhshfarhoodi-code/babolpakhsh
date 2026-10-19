import React, { useState, useMemo, useEffect } from 'react';
import { Supermarket, Visitor } from '../../types';
import { useApp } from '../../context/AppContext';
import { MIN_PASSWORD_LENGTH, normalizePhone } from '../../context/utils';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { LocationPickerModal } from '../LocationPickerModal';
import {
  X,
  Store,
  User,
  MapPin,
  Truck,
  Phone,
  KeyRound,
  Lock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  AtSign,
  Save,
  Navigation,
  ExternalLink,
  ShieldCheck,
  Building2,
  BadgeCheck,
  Shield,
  Clock,
  Sparkles,
} from 'lucide-react';
import { formatPersianDate } from '../../utils/dateUtils';
import {
  getStoreFounderDiscountStatus,
  getStoreFounderDiscountUserEnabled,
} from '../../utils/storeDiscount';

interface StoreProfileSheetProps {
  isOpen: boolean;
  onClose: () => void;
  store?: Supermarket;
  visitor?: Visitor;
}

export const StoreProfileSheet: React.FC<StoreProfileSheetProps> = ({
  isOpen,
  onClose,
  store,
  visitor,
}) => {
  const { visitors, supermarkets, orders, updateSupermarket, resetSupermarketPassword, updateStoreDiscountPreferences } = useApp();

  const founderStatus = useMemo(() => {
    return getStoreFounderDiscountStatus(supermarkets, orders, store?.id);
  }, [supermarkets, orders, store?.id]);

  // مقدار کلید از آبجکت زنده‌ی فروشگاه در state (دیتابیس) خوانده می‌شود، نه نسخه‌ی قدیمی prop
  const liveStore = store ? (supermarkets.find((s) => s.id === store.id) || store) : undefined;
  const founderUserEnabled = getStoreFounderDiscountUserEnabled(store?.id || '', liveStore);

  const handleToggleFounder = () => {
    if (!store?.id || !founderStatus.isFounderQuotaAvailable) return;
    void updateStoreDiscountPreferences(store.id, { founder: !founderUserEnabled });
  };

  // Profile State (Store Name, Owner Name, Phone, Address, Location)
  const [nameInput, setNameInput] = useState(store?.name || '');
  const [ownerInput, setOwnerInput] = useState(store?.owner || '');
  const [phoneInput, setPhoneInput] = useState(store?.phone || '');
  const [addressInput, setAddressInput] = useState(store?.address || '');
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(
    store?.latitude && store?.longitude ? { lat: store.latitude, lng: store.longitude } : null
  );
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSaveSuccess, setProfileSaveSuccess] = useState<string | null>(null);
  const [profileSaveError, setProfileSaveError] = useState<string | null>(null);

  // Sync state whenever store changes or sheet opens
  useEffect(() => {
    if (store) {
      setNameInput(store.name || '');
      setOwnerInput(store.owner || '');
      setPhoneInput(store.phone || '');
      setAddressInput(store.address || '');
      if (typeof store.latitude === 'number' && typeof store.longitude === 'number') {
        setLocation({ lat: store.latitude, lng: store.longitude });
      } else {
        setLocation(null);
      }
    }
  }, [store, isOpen]);

  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const activeVisitors = useMemo(
    () => visitors.filter((v) => v.is_active !== false),
    [visitors]
  );

  if (!isOpen) return null;

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!store?.id) return;

    if (!nameInput.trim()) {
      setProfileSaveError('نام فروشگاه الزامی است.');
      return;
    }
    if (!ownerInput.trim()) {
      setProfileSaveError('نام مدیر یا مالک فروشگاه الزامی است.');
      return;
    }
    if (!phoneInput.trim()) {
      setProfileSaveError('شماره تماس یا موبایل الزامی است.');
      return;
    }
    if (!addressInput.trim()) {
      setProfileSaveError('آدرس متنی فروشگاه الزامی است.');
      return;
    }

    setProfileSaveError(null);
    setProfileSaveSuccess(null);
    setIsSavingProfile(true);

    try {
      const res = await updateSupermarket(store.id, {
        name: nameInput.trim(),
        owner: ownerInput.trim(),
        phone: phoneInput.trim(),
        address: addressInput.trim(),
        latitude: location ? location.lat : null,
        longitude: location ? location.lng : null,
      });

      if (res.success) {
        setProfileSaveSuccess('مشخصات پروفایل با موفقیت بروزرسانی شد.');
        setTimeout(() => setProfileSaveSuccess(null), 3500);
      } else {
        setProfileSaveError(res.message || 'خطا در ذخیره مشخصات پروفایل.');
      }
    } catch {
      setProfileSaveError('خطا در برقراری ارتباط با سرور.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleChangePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!store?.id) return;

    setError(null);
    setSuccess(null);

    const cleanCurrent = currentPassword.trim();
    const cleanPass = newPassword.trim();
    const cleanConfirm = confirmPassword.trim();

    if (!cleanCurrent) {
      setError('لطفاً رمز عبور فعلی خود را وارد نمایید.');
      return;
    }
    if (!cleanPass) {
      setError('لطفاً رمز عبور جدید را وارد نمایید.');
      return;
    }
    if (cleanPass.length < MIN_PASSWORD_LENGTH) {
      setError(`رمز عبور جدید باید حداقل ${MIN_PASSWORD_LENGTH} کاراکتر باشد.`);
      return;
    }
    if (cleanPass !== cleanConfirm) {
      setError('رمز عبور جدید با تکرار آن مطابقت ندارد.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (isSupabaseConfigured && supabase) {
        // 1. Verify current password
        const phone = normalizePhone(store.phone);
        const email = `${phone}@babolpakhsh.internal`;

        const { error: verifyErr } = await supabase.auth.signInWithPassword({
          email,
          password: cleanCurrent,
        });

        if (verifyErr) {
          setError('رمز عبور فعلی نادرست است.');
          setIsSubmitting(false);
          return;
        }

        // 2. Update user password in Supabase Auth
        const { error: updateErr } = await supabase.auth.updateUser({
          password: cleanPass,
        });

        if (updateErr) {
          setError(updateErr.message || 'خطا در تغییر رمز عبور در سرور.');
          setIsSubmitting(false);
          return;
        }
      } else {
        await resetSupermarketPassword(store.id, cleanPass);
      }

      setSuccess('رمز عبور با موفقیت تغییر یافت.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        setShowPasswordForm(false);
        setSuccess(null);
      }, 2000);
    } catch {
      setError('خطایی در فرایند تغییر رمز عبور رخ داد.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-xs p-0 sm:p-4 overflow-y-auto">
      {/* Backdrop click to dismiss */}
      <div className="absolute inset-0" onClick={onClose} />

      <div className="relative z-10 bg-slate-900 border border-slate-800 rounded-t-2xl sm:rounded-2xl w-full max-w-md p-4 space-y-4 shadow-2xl my-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-600/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <Store className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100">{store?.name || 'فروشگاه طرف قرارداد'}</h3>
              <p className="text-xs text-slate-400">پروفایل فروشگاه و مدیریت حساب</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Verification Status Card */}
        {(() => {
          const vType = store?.verification_type || 'none';
          if (vType === 'store') {
            return (
              <div className="p-3 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0">
                    <BadgeCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 font-bold text-emerald-300">
                      <span>احراز هویت به عنوان فروشگاه</span>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    </div>
                    <p className="text-[11px] text-slate-300 mt-0.5">
                      حساب کاربری شما رسماً به عنوان واحد خرده‌فروشی / سوپرمارکت تایید شده است.
                    </p>
                  </div>
                </div>
              </div>
            );
          }
          if (vType === 'bulk_consumer') {
            return (
              <div className="p-3 rounded-2xl bg-indigo-950/40 border border-indigo-500/40 flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center shrink-0">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 font-bold text-indigo-300">
                      <span>احراز هویت به عنوان مصرف‌کننده عمده</span>
                      <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400" />
                    </div>
                    <p className="text-[11px] text-slate-300 mt-0.5">
                      حساب کاربری شما به عنوان مصرف‌کننده عمده (ارگانی، رستورانی یا سازمانی) ثبت گردیده است.
                    </p>
                  </div>
                </div>
              </div>
            );
          }
          // Default: 'none'
          return (
            <div className="p-3 rounded-2xl bg-slate-800/40 border border-slate-700/60 flex items-center gap-3 text-xs">
              <div className="w-8 h-8 rounded-xl bg-slate-700/30 text-slate-400 border border-slate-600/40 flex items-center justify-center shrink-0">
                <Shield className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 font-bold text-slate-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                  <span>احراز هویت انجام نشده</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                  احراز هویت پس از بررسی کارشناسان تکمیل خواهد شد و مانعی برای سفارش‌گذاری نیست.
                </p>
              </div>
            </div>
          );
        })()}

        {/* Profile Information Edit Form */}
        <form onSubmit={handleSaveProfile} className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800/90 space-y-3">
          <div className="flex items-center justify-between pb-1 border-b border-slate-800/60">
            <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
              <Store className="w-3.5 h-3.5 text-emerald-400" />
              <span>مشخصات فروشگاه و اطلاعات تماس</span>
            </span>
            <span className="text-[10px] text-slate-400">امکان ویرایش توسط کاربر</span>
          </div>

          {/* Store Name Input */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-300 mb-1">
              نام فروشگاه / سوپرمارکت:
            </label>
            <input
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="مثال: سوپرمارکت بهاران"
              disabled={isSavingProfile}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 transition"
            />
          </div>

          {/* Owner / Manager Name Input */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-300 mb-1">
              نام و نام‌خانوادگی مالک یا مدیریت:
            </label>
            <input
              type="text"
              value={ownerInput}
              onChange={(e) => setOwnerInput(e.target.value)}
              placeholder="مثال: علیرضا رضایی"
              disabled={isSavingProfile}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 transition"
            />
          </div>

          {/* Phone Number Input */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-300 mb-1">
              شماره تماس و موبایل فروشگاه:
            </label>
            <input
              type="tel"
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value)}
              placeholder="۰۹۱۲XXXXXXX"
              disabled={isSavingProfile}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 font-mono transition dir-ltr text-right"
            />
          </div>

          {/* Registration Date (Read-only reference) */}
          {store?.created_at && (
            <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900/60 border border-slate-800/80 text-[11px] text-slate-400">
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>تاریخ عضویت در سامانه:</span>
              </div>
              <span className="font-mono text-slate-300 dir-ltr">{formatPersianDate(store.created_at)}</span>
            </div>
          )}

          {/* Text Address Input */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-300 mb-1">
              آدرس دقیق متنی فروشگاه:
            </label>
            <textarea
              rows={2}
              value={addressInput}
              onChange={(e) => setAddressInput(e.target.value)}
              placeholder="خیابان، کوچه، پلاک، نام مجتمع..."
              disabled={isSavingProfile}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 transition resize-none"
            />
          </div>

          {/* Map Location Box */}
          <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800/80 space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0">
                  <Navigation className="w-3.5 h-3.5" />
                </div>
                <div>
                  <span className="text-[11px] font-bold text-slate-200 block">
                    موقعیت مکانی روی نقشه
                  </span>
                  {location ? (
                    <span className="text-[10px] text-emerald-400 font-medium">
                      ✓ موقعیت ثبت شده است
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-400">
                      موقعیت ثبت نشده است (اختیاری)
                    </span>
                  )}
                </div>
              </div>

              {location ? (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setIsLocationModalOpen(true)}
                    className="px-2 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[11px] font-medium transition cursor-pointer"
                  >
                    تغییر
                  </button>
                  <button
                    type="button"
                    onClick={() => setLocation(null)}
                    className="px-2 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[11px] font-medium transition cursor-pointer"
                  >
                    حذف
                  </button>
                  <a
                    href={`https://www.google.com/maps?q=${location.lat},${location.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-blue-400 text-[11px] transition flex items-center gap-1"
                    title="مشاهده در گوگل مپ"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsLocationModalOpen(true)}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[11px] transition shadow-xs cursor-pointer"
                >
                  <MapPin className="w-3.5 h-3.5" />
                  <span>انتخاب روی نقشه</span>
                </button>
              )}
            </div>

            {location && (
              <div className="pt-1.5 border-t border-slate-800 flex items-center justify-between text-[10px] text-slate-400">
                <span>مختصات جغرافیایی:</span>
                <span className="font-mono text-slate-300 dir-ltr">
                  {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
                </span>
              </div>
            )}
          </div>

          {/* Notification Messages */}
          {profileSaveSuccess && (
            <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-2 text-emerald-400 text-xs animate-in fade-in">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span>{profileSaveSuccess}</span>
            </div>
          )}
          {profileSaveError && (
            <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-center gap-2 text-rose-400 text-xs animate-in fade-in">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{profileSaveError}</span>
            </div>
          )}

          {/* Unified Save Button */}
          <button
            type="submit"
            disabled={isSavingProfile}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-98 text-white font-bold text-xs transition shadow-md shadow-emerald-600/30 cursor-pointer disabled:opacity-50"
          >
            {isSavingProfile ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>در حال ذخیره تغییرات...</span>
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                <span>ذخیره تغییرات مشخصات فروشگاه</span>
              </>
            )}
          </button>
        </form>

          {/* Visitor assignment display section */}
          <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/90 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-300 font-semibold text-xs">
                <Truck className="w-4 h-4 text-blue-400" />
                <span>ویزیتور مسئول فروشگاه شما:</span>
              </div>
            </div>

            {visitor ? (
              <div className="p-2.5 rounded-xl bg-blue-950/30 border border-blue-900/50 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-100 text-xs">{visitor.name}</span>
                  {visitor.region && (
                    <span className="text-[11px] text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                      {visitor.region}
                    </span>
                  )}
                </div>
                {visitor.phone && (
                  <div className="pt-2 border-t border-blue-900/40 flex items-center justify-between">
                    <span className="text-slate-400 font-mono text-xs dir-ltr">{visitor.phone}</span>
                    <a
                      href={`tel:${visitor.phone}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-sm transition"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      <span>تماس تلفنی</span>
                    </a>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-2.5 rounded-xl bg-amber-950/20 border border-amber-900/40 space-y-1">
                <span className="text-xs font-bold text-amber-300 block">خرید مستقیم از پخش مرکزی (بدون ویزیتور)</span>
                <p className="text-[11px] text-slate-400">
                  سفارش‌های شما مستقیماً توسط واحد فروش مرکزی پردازش و ارسال می‌گردد.
                </p>
              </div>
            )}
          </div>

          {/* Founder Discount Settings Card (if eligible) */}
          {founderStatus.isFounderQuotaAvailable && (
            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/90 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-300 font-semibold text-xs">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span>طرح تخفیف {founderStatus.founderPercent}٪ آغازین:</span>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-md font-bold border bg-purple-950/60 text-purple-300 border-purple-500/40">
                  {founderStatus.remainingOrdersCount.toLocaleString('fa-IR')} سفارش مانده
                </span>
              </div>

              <div
                onClick={handleToggleFounder}
                className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer select-none transition ${
                  founderUserEnabled
                    ? 'bg-gradient-to-r from-purple-950/60 via-slate-900 to-amber-950/40 border-purple-500/50 text-purple-100 shadow-xs'
                    : 'bg-slate-900/90 border-slate-800 text-slate-400 hover:border-slate-700 shadow-xs'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`w-8 h-4.5 rounded-full p-0.5 transition-colors duration-200 ease-in-out shrink-0 ${
                      founderUserEnabled ? 'bg-purple-500' : 'bg-slate-700'
                    }`}
                  >
                    <div
                      className={`w-3.5 h-3.5 rounded-full bg-white shadow transition-transform duration-200 ease-in-out ${
                        founderUserEnabled ? 'translate-x-[-14px]' : 'translate-x-0'
                      }`}
                    />
                  </div>
                  <div>
                    <span className="font-bold text-xs block text-slate-100">
                      اعمال تخفیف ۵٪ در سبد سفارش
                    </span>
                    <span className="text-[10.5px] text-slate-400 block mt-0.5">
                      {founderUserEnabled
                        ? 'تخفیف در سفارش بعدی شما اعمال خواهد شد.'
                        : 'غیرفعال است؛ سهمیه تخفیف برای سفارش‌های بعدی شما محفوظ می‌ماند.'}
                    </span>
                  </div>
                </div>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-md font-bold border shrink-0 ${
                    founderUserEnabled
                      ? 'bg-purple-500/20 text-purple-200 border-purple-500/50'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}
                >
                  {founderUserEnabled ? 'فعال' : 'غیرفعال'}
                </span>
              </div>
            </div>
          )}

        {/* Password Change Action Section */}
        <div className="pt-2 border-t border-slate-800 space-y-3">
          {!showPasswordForm ? (
            <button
              type="button"
              onClick={() => {
                setShowPasswordForm(true);
                setError(null);
                setSuccess(null);
              }}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold transition cursor-pointer"
            >
              <KeyRound className="w-4 h-4 text-amber-400" />
              <span>تغییر رمز عبور حساب کاربری</span>
            </button>
          ) : (
            <form onSubmit={handleChangePasswordSubmit} className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-3 animate-in fade-in duration-200">
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
                  <Lock className="w-3.5 h-3.5 text-amber-400" />
                  <span>تغییر رمز عبور ورود</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowPasswordForm(false);
                    setError(null);
                    setSuccess(null);
                  }}
                  className="text-slate-400 hover:text-slate-200 text-xs cursor-pointer"
                >
                  انصراف
                </button>
              </div>

              {error && (
                <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-center gap-2 text-rose-400 text-xs">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {success && (
                <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-2 text-emerald-400 text-xs">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>{success}</span>
                </div>
              )}

              <div className="space-y-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">رمز عبور فعلی</label>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="رمز عبور فعلی ورود"
                    disabled={isSubmitting}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 text-xs font-mono focus:outline-none focus:border-amber-500"
                    dir="ltr"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">رمز عبور جدید</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="حداقل ۶ کاراکتر"
                    disabled={isSubmitting}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 text-xs font-mono focus:outline-none focus:border-amber-500"
                    dir="ltr"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">تکرار رمز عبور جدید</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="تکرار همان رمز"
                    disabled={isSubmitting}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 text-xs font-mono focus:outline-none focus:border-amber-500"
                    dir="ltr"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>در حال ذخیره...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>ثبت و ذخیره رمز جدید</span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>

        {/* Dismiss Button */}
        <button
          type="button"
          onClick={onClose}
          className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition cursor-pointer"
        >
          بستن
        </button>
      </div>

      <LocationPickerModal
        isOpen={isLocationModalOpen}
        initial={location}
        onConfirm={(lat, lng) => setLocation({ lat, lng })}
        onClose={() => setIsLocationModalOpen(false)}
      />
    </div>
  );
};

