import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { supabase, getFunctionErrorMessage } from '../lib/supabase';
import { normalizeDigits, normalizePhone } from '../context/utils';
import {
  KeyRound,
  ShieldAlert,
  Eye,
  EyeOff,
  LogOut,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Lock,
} from 'lucide-react';

interface ForcePasswordChangeModalProps {
  isOpen: boolean;
}

export const ForcePasswordChangeModal: React.FC<ForcePasswordChangeModalProps> = ({ isOpen }) => {
  const { currentUser, logout, showToast, setMustChangePassword } = useApp();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanPass = normalizeDigits(newPassword.trim());
    const cleanConfirm = normalizeDigits(confirmPassword.trim());

    // Validation 1: Min length 6
    if (cleanPass.length < 6) {
      setErrorMessage('رمز عبور باید حداقل ۶ کاراکتر باشد.');
      return;
    }

    // Validation 2: Passwords match
    if (cleanPass !== cleanConfirm) {
      setErrorMessage('تکرار رمز عبور با رمز عبور وارد شده مطابقت ندارد.');
      return;
    }

    // Validation 3: Cannot equal mobile phone or username
    const userPhoneClean = normalizePhone(currentUser.phone || '');
    if (userPhoneClean && cleanPass === userPhoneClean) {
      setErrorMessage('رمز عبور نباید کاملاً برابر شماره موبایل شما باشد.');
      return;
    }
    if (currentUser.username && cleanPass === normalizeDigits(currentUser.username)) {
      setErrorMessage('رمز عبور نباید کاملاً برابر نام کاربری شما باشد.');
      return;
    }

    // Validation 4: Cannot be repetitive digits like 111111, 000000
    if (/^(\d)\1+$/.test(cleanPass)) {
      setErrorMessage('رمز عبور نباید از ارقام کاملاً تکراری (مانند ۱۱۱۱۱۱) باشد.');
      return;
    }

    // Validation 5: Cannot be trivial sequential patterns like 123456 or 654321
    const sequentialPatterns = [
      '123456',
      '654321',
      '012345',
      '543210',
      '1234567',
      '7654321',
      '12345678',
      '87654321',
      '123456789',
    ];
    if (sequentialPatterns.includes(cleanPass)) {
      setErrorMessage('رمز عبور نباید از ارقام ساده و متوالی (مانند ۱۲۳۴۵۶) باشد.');
      return;
    }

    setIsSubmitting(true);

    try {
      if (!supabase) {
        throw new Error('اتصال به سرور برقرار نیست یا پایگاه داده پیکربندی نشده است.');
      }

      const { error } = await supabase.auth.updateUser({
        password: cleanPass,
        data: { must_change_password: false },
      });

      if (error) {
        const msg = await getFunctionErrorMessage(error, 'خطا در تغییر رمز عبور کاربر.');
        setErrorMessage(msg);
        return;
      }

      setMustChangePassword(false);
      showToast('رمز عبور شما با موفقیت تغییر یافت و فعال شد.', 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'خطای غیرمنتظره در به‌روزرسانی رمز عبور';
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in select-none"
      dir="rtl"
    >
      <div
        className="w-full max-w-md bg-slate-900 border border-amber-500/40 rounded-3xl p-6 sm:p-7 shadow-2xl space-y-5 text-right"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with Icon */}
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/15 text-amber-400 flex items-center justify-center border border-amber-500/30 shadow-lg shadow-amber-500/10">
            <KeyRound className="w-7 h-7" />
          </div>
          <div>
            <h3 className="font-bold text-base sm:text-lg text-slate-100">
              تغییر اجباری رمز عبور
            </h3>
            <p className="text-amber-300 text-xs mt-1 font-medium">
              برای امنیت حساب، رمز عبور خود را تغییر دهید
            </p>
          </div>
        </div>

        {/* User Identity Note */}
        <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-2xl flex items-center justify-between text-xs text-slate-300">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-slate-400" />
            <span className="font-medium">فروشگاه:</span>
            <span className="font-bold text-slate-100">{currentUser.name}</span>
          </div>
          <span className="font-mono text-slate-400">{currentUser.phone}</span>
        </div>

        {/* Error Feedback */}
        {errorMessage && (
          <div className="p-3 bg-rose-500/15 border border-rose-500/30 rounded-2xl flex items-start gap-2.5 text-rose-300 animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <p className="text-xs leading-relaxed font-medium">{errorMessage}</p>
          </div>
        )}

        {/* Password Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* New Password */}
          <div className="space-y-1.5">
            <label className="block text-slate-300 text-xs font-bold">
              رمز عبور جدید:
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                autoFocus
                disabled={isSubmitting}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="حداقل ۶ کاراکتر"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-100 text-sm font-sans focus:border-amber-500 focus:outline-none transition pl-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition cursor-pointer p-1"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          <div className="space-y-1.5">
            <label className="block text-slate-300 text-xs font-bold">
              تکرار رمز عبور جدید:
            </label>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                required
                disabled={isSubmitting}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="تکرار همان رمز عبور"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-100 text-sm font-sans focus:border-amber-500 focus:outline-none transition pl-10"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                tabIndex={-1}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition cursor-pointer p-1"
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Validation Rules Checklist */}
          <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-850 space-y-1 text-[11px] text-slate-400">
            <p className="flex items-center gap-1.5 text-slate-300 font-semibold mb-1">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
              <span>قوانین تعیین رمز:</span>
            </p>
            <p>• حداقل ۶ کاراکتر باشد.</p>
            <p>• برابر شماره موبایل نباشد.</p>
            <p>• از ارقام ساده مثل ۱۱۱۱۱۱ یا ۱۲۳۴۵۶ نباشد.</p>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting || !newPassword || !confirmPassword}
            className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold text-sm transition cursor-pointer shadow-lg shadow-amber-500/25 flex items-center justify-center gap-2 mt-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>در حال ثبت رمز جدید...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>ذخیره رمز جدید و ورود به پنل</span>
              </>
            )}
          </button>
        </form>

        {/* Logout Link */}
        <div className="pt-2 border-t border-slate-800 text-center">
          <button
            type="button"
            onClick={logout}
            className="text-xs text-rose-400 hover:text-rose-300 font-bold transition flex items-center justify-center gap-1.5 mx-auto cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>خروج از حساب کاربری</span>
          </button>
        </div>
      </div>
    </div>
  );
};
