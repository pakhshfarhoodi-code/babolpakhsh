import React, { useState } from 'react';
import { Visitor } from '../../types';
import { useApp } from '../../context/AppContext';
import {
  X,
  Truck,
  User,
  Phone,
  MapPin,
  KeyRound,
  Lock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  AtSign,
} from 'lucide-react';

interface VisitorProfileSheetProps {
  isOpen: boolean;
  onClose: () => void;
  visitor?: Visitor;
}

export const VisitorProfileSheet: React.FC<VisitorProfileSheetProps> = ({
  isOpen,
  onClose,
  visitor,
}) => {
  const { resetVisitorPassword } = useApp();

  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleChangePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!visitor?.id) return;

    setError(null);
    setSuccess(null);

    const cleanPass = newPassword.trim();
    const cleanConfirm = confirmPassword.trim();

    if (!cleanPass) {
      setError('لطفاً رمز عبور جدید را وارد نمایید.');
      return;
    }
    if (cleanPass.length < 4) {
      setError('رمز عبور جدید باید حداقل ۴ کاراکتر باشد.');
      return;
    }
    if (cleanPass !== cleanConfirm) {
      setError('رمز عبور جدید با تکرار آن مطابقت ندارد.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await resetVisitorPassword(visitor.id, cleanPass);
      if (res.success) {
        setSuccess('رمز عبور حساب کاربری ویزیتور با موفقیت تغییر یافت.');
        setNewPassword('');
        setConfirmPassword('');
        setTimeout(() => {
          setShowPasswordForm(false);
          setSuccess(null);
        }, 2000);
      } else {
        setError(res.message || 'خطا در تغییر رمز عبور.');
      }
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
            <div className="w-8 h-8 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
              <Truck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100">{visitor?.name || 'واحد ویزیت و توزیع'}</h3>
              <p className="text-xs text-slate-400">پروفایل ویزیتور و مدیریت حساب</p>
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
              <User className="w-4 h-4 text-blue-400" />
              <span>نام و نام خانوادگی:</span>
            </div>
            <span className="font-bold text-slate-200">{visitor?.name || 'نامشخص'}</span>
          </div>

          {visitor?.phone && (
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
              <div className="flex items-center gap-2 text-slate-400">
                <Phone className="w-4 h-4 text-blue-400" />
                <span>شماره تماس:</span>
              </div>
              <span className="font-mono font-bold text-slate-200 dir-ltr">{visitor.phone}</span>
            </div>
          )}

          {visitor?.region && (
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
              <div className="flex items-center gap-2 text-slate-400">
                <MapPin className="w-4 h-4 text-blue-400" />
                <span>منطقه توزیع:</span>
              </div>
              <span className="font-bold text-blue-300">{visitor.region}</span>
            </div>
          )}

          {visitor?.username && (
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
              <div className="flex items-center gap-2 text-slate-400">
                <AtSign className="w-4 h-4 text-blue-400" />
                <span>نام کاربری ورود:</span>
              </div>
              <span className="font-mono font-bold text-blue-300 dir-ltr">
                {visitor.username && !visitor.username.includes('-') && visitor.username.length < 25
                  ? visitor.username
                  : (visitor.phone || 'مشخص نشده')}
              </span>
            </div>
          )}
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
                  <span>تغییر رمز عبور ورود ویزیتور</span>
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
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">رمز عبور جدید</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="حداقل ۴ کاراکتر"
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
