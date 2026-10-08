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
} from 'lucide-react';

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
  const { visitors, updateSupermarket, resetSupermarketPassword } = useApp();

  // Address and Location State
  const [addressInput, setAddressInput] = useState(store?.address || '');
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(
    store?.latitude && store?.longitude ? { lat: store.latitude, lng: store.longitude } : null
  );
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [isSavingAddress, setIsSavingAddress] = useState(false);
  const [addressSaveSuccess, setAddressSaveSuccess] = useState<string | null>(null);
  const [addressSaveError, setAddressSaveError] = useState<string | null>(null);

  // Sync state whenever store changes
  useEffect(() => {
    if (store) {
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

  const handleSaveAddressAndLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!store?.id) return;

    setAddressSaveError(null);
    setAddressSaveSuccess(null);
    setIsSavingAddress(true);

    try {
      const res = await updateSupermarket(store.id, {
        address: addressInput.trim(),
        latitude: location ? location.lat : null,
        longitude: location ? location.lng : null,
      });

      if (res.success) {
        setAddressSaveSuccess('آدرس و موقعیت مکانی با موفقیت بروزرسانی شد.');
        setTimeout(() => setAddressSaveSuccess(null), 3000);
      } else {
        setAddressSaveError(res.message || 'خطا در ذخیره مشخصات آدرس');
      }
    } catch {
      setAddressSaveError('خطا در برقراری ارتباط با سرور.');
    } finally {
      setIsSavingAddress(false);
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

        {/* Details list */}
        <div className="space-y-2.5 text-xs">
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <div className="flex items-center gap-2 text-slate-400">
              <User className="w-4 h-4 text-emerald-400" />
              <span>مدیریت / مالک:</span>
            </div>
            <span className="font-bold text-slate-200">{store?.owner || 'مدیر فروشگاه'}</span>
          </div>

          {store?.username && (
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
              <div className="flex items-center gap-2 text-slate-400">
                <Phone className="w-4 h-4 text-emerald-400" />
                <span>شماره ورود:</span>
              </div>
              <span className="font-mono font-bold text-emerald-300 dir-ltr">{store.username}</span>
            </div>
          )}

          {/* Address and Map Location Section */}
          <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/90 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-300 font-semibold text-xs">
                <MapPin className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>آدرس و موقعیت دقیق فروشگاه:</span>
              </div>
            </div>

            {/* Detailed Text Address */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                آدرس متنی فروشگاه
              </label>
              <textarea
                rows={2}
                value={addressInput}
                onChange={(e) => setAddressInput(e.target.value)}
                placeholder="خیابان، کوچه، پلاک، نام مجتمع..."
                disabled={isSavingAddress}
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

            {/* Notification messages */}
            {addressSaveSuccess && (
              <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-2 text-emerald-400 text-xs animate-in fade-in">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>{addressSaveSuccess}</span>
              </div>
            )}
            {addressSaveError && (
              <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-center gap-2 text-rose-400 text-xs animate-in fade-in">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{addressSaveError}</span>
              </div>
            )}

            {/* Save Address Button */}
            <button
              type="button"
              onClick={handleSaveAddressAndLocation}
              disabled={isSavingAddress}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-98 text-white font-bold text-xs transition shadow-sm cursor-pointer disabled:opacity-50"
            >
              {isSavingAddress ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>در حال ذخیره آدرس و موقعیت...</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>ذخیره تغییرات آدرس و موقعیت</span>
                </>
              )}
            </button>
          </div>

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
        </div>

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

