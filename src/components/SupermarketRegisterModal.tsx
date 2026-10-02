import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  Store,
  User,
  Phone,
  MapPin,
  Truck,
  Check,
  X,
  AlertCircle,
  KeyRound,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { normalizePhone, isValidMobile, MIN_PASSWORD_LENGTH } from '../context/utils';

interface SupermarketRegisterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  defaultVisitorId?: string;
}

export const SupermarketRegisterModal: React.FC<SupermarketRegisterModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  defaultVisitorId,
}) => {
  const { visitors, registerSupermarket } = useApp();

  const [name, setName] = useState('');
  const [owner, setOwner] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [address, setAddress] = useState('');
  const [assignedVisitorId, setAssignedVisitorId] = useState(defaultVisitorId || 'direct');
  const [showMoreInfo, setShowMoreInfo] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccessModal, setIsSuccessModal] = useState(false);

  // Sync assigned visitor when defaultVisitorId or isOpen changes
  React.useEffect(() => {
    if (defaultVisitorId) {
      setAssignedVisitorId(defaultVisitorId);
    }
  }, [defaultVisitorId, isOpen]);

  if (!isOpen) return null;

  const isRegisteredByVisitor = Boolean(defaultVisitorId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const cleanName = name.trim();
    const cleanPhone = normalizePhone(phone);
    const cleanPassword = password.trim();
    const cleanAddress = address.trim();

    if (!cleanName) {
      setError('لطفاً نام فروشگاه یا هایپرمارکت را وارد کنید.');
      return;
    }
    if (!cleanPhone || !isValidMobile(cleanPhone)) {
      setError('شماره موبایل معتبر وارد کنید (نمونه: ۰۹۱۲۳۴۵۶۷۸۹).');
      return;
    }
    if (!cleanPassword) {
      setError('لطفاً رمز عبور را جهت ورود به حساب کاربری وارد نمایید.');
      return;
    }
    if (cleanPassword.length < MIN_PASSWORD_LENGTH) {
      setError(`رمز عبور باید حداقل ${MIN_PASSWORD_LENGTH} کاراکتر باشد.`);
      return;
    }
    if (!cleanAddress) {
      setError('لطفاً آدرس دقیق جهت ارسال سفارشات را درج کنید.');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await registerSupermarket({
        name: cleanName,
        owner: owner.trim(),
        phone: cleanPhone,
        address: cleanAddress,
        assigned_visitor_id: isRegisteredByVisitor ? defaultVisitorId : assignedVisitorId,
        password: cleanPassword,
      });

      if (result.success) {
        setIsSuccessModal(true);
        if (onSuccess) onSuccess();
      } else {
        setError(result.message);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'خطا در برقراری ارتباط با سرور.';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCloseAll = () => {
    setIsSuccessModal(false);
    onClose();
  };

  if (isSuccessModal) {
    const registeredPhone = normalizePhone(phone);
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden p-6 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 mx-auto flex items-center justify-center shadow-inner">
            <Check className="w-7 h-7 stroke-[3]" />
          </div>

          <div className="space-y-1.5">
            <h3 className="text-base font-bold text-slate-100">حساب کاربری شما با موفقیت ایجاد و فعال شد</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              حساب فروشگاه <strong className="text-amber-400">«{name}»</strong> فعال گردید. اکنون می‌توانید با شماره موبایل <strong className="text-amber-300 font-mono dir-ltr">{registeredPhone}</strong> و رمز عبور تعیین‌شده وارد سامانه شوید.
            </p>
          </div>

          <button
            type="button"
            onClick={handleCloseAll}
            className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition cursor-pointer shadow-md shadow-amber-500/20"
          >
            بستن و ورود به حساب
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">ثبت‌نام و عضویت فروشگاه</h2>
              <p className="text-xs text-slate-400">ثبت مستقیم با شماره موبایل و رمز عبور</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-xl transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 overflow-y-auto space-y-4 text-right">
          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {/* 1. Store Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              نام فروشگاه / سوپرمارکت <span className="text-amber-400">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="مثلاً: هایپرمارکت ساحل"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-amber-500 transition"
              />
              <Store className="w-4 h-4 text-slate-500 absolute left-3 top-3 pointer-events-none" />
            </div>
          </div>

          {/* 2. Mobile Phone with Helper Note */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              شماره تلفن همراه <span className="text-amber-400">*</span>
            </label>
            <div className="relative">
              <input
                type="tel"
                inputMode="tel"
                dir="ltr"
                placeholder="۰۹۱۲۳۴۵۶۷۸۹"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-amber-500 font-mono text-left transition"
              />
              <Phone className="w-4 h-4 text-slate-500 absolute left-3 top-3 pointer-events-none" />
            </div>
            <p className="text-[11px] text-amber-400/90 mt-1">
              این شماره به عنوان نام کاربری ورود شما به سامانه استفاده خواهد شد.
            </p>
          </div>

          {/* 3. Password with show/hide toggle */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              رمز عبور حساب <span className="text-amber-400">*</span> (حداقل ۶ کاراکتر)
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                dir="ltr"
                required
                placeholder="••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pr-3.5 pl-10 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-amber-500 font-mono text-left transition"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute left-3 top-2.5 p-1 text-slate-400 hover:text-slate-200 transition cursor-pointer"
                title={showPassword ? 'پنهان کردن رمز' : 'نمایش رمز'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* 4. Address */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              آدرس دقیق فروشگاه <span className="text-amber-400">*</span>
            </label>
            <div className="relative">
              <textarea
                rows={2}
                placeholder="خیابان، کوچه، پلاک..."
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-amber-500 transition resize-none"
              />
              <MapPin className="w-4 h-4 text-slate-500 absolute left-3 top-3 pointer-events-none" />
            </div>
          </div>

          {/* 5. Collapsed "اطلاعات بیشتر" section (Manager name + visitor) */}
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setShowMoreInfo((prev) => !prev)}
              className="w-full flex items-center justify-between p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-xs font-medium text-slate-300 hover:text-slate-100 hover:bg-slate-950 transition cursor-pointer"
            >
              <span>اطلاعات بیشتر (اختیاری)</span>
              {showMoreInfo ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
            </button>

            {showMoreInfo && (
              <div className="mt-3 p-3.5 rounded-xl bg-slate-950/80 border border-slate-800/90 space-y-3.5 animate-in fade-in duration-150">
                {/* Manager Name */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    نام مدیریت یا مسئول
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="نام و نام خانوادگی مدیر فروشگاه"
                      value={owner}
                      onChange={(e) => setOwner(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-500 transition"
                    />
                    <User className="w-4 h-4 text-slate-500 absolute left-3 top-2.5 pointer-events-none" />
                  </div>
                </div>

                {/* Assigned Visitor - ONLY shown if NOT registered by visitor */}
                {!isRegisteredByVisitor && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      ویزیتور مسئول یا نحوه خرید
                    </label>
                    <div className="relative">
                      <select
                        dir="rtl"
                        value={assignedVisitorId}
                        onChange={(e) => setAssignedVisitorId(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl pr-3.5 pl-10 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-500 transition appearance-none cursor-pointer text-right"
                      >
                        <option value="direct" className="bg-slate-900 text-slate-100 py-1.5 px-3">
                          خرید مستقیم از پخش فرهودی
                        </option>
                        {visitors.filter((v) => v.is_active !== false).map((v) => (
                          <option key={v.id} value={v.id} className="bg-slate-900 text-slate-100 py-1.5 px-3">
                            {v.name} — ({v.region})
                          </option>
                        ))}
                      </select>
                      <Truck className="w-4 h-4 text-slate-500 absolute left-3 top-2.5 pointer-events-none" />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer Action */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-700 hover:bg-slate-800 text-xs font-medium text-slate-300 transition cursor-pointer"
            >
              انصراف
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition cursor-pointer shadow-lg shadow-amber-500/20 disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              <span>ثبت‌نام و ایجاد حساب</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
