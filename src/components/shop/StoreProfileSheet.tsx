import React, { useState, useMemo } from 'react';
import { Supermarket, Visitor } from '../../types';
import { useApp } from '../../context/AppContext';
import { MIN_PASSWORD_LENGTH, normalizePhone } from '../../context/utils';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
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

          {store?.address && (
            <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-1">
              <div className="flex items-center gap-2 text-slate-400">
                <MapPin className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>آدرس فروشگاه:</span>
              </div>
              <p className="text-slate-200 text-xs leading-relaxed pr-6">{store.address}</p>
            </div>
          )}

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
    </div>
  );
};

