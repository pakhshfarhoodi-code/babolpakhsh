import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Store, User, Phone, MapPin, Truck, Check, X, AlertCircle, KeyRound, AtSign } from 'lucide-react';

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
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [assignedVisitorId, setAssignedVisitorId] = useState(defaultVisitorId || 'direct');
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('لطفاً نام فروشگاه یا هایپرمارکت را وارد کنید.');
      return;
    }
    if (!owner.trim()) {
      setError('لطفاً نام و نام خانوادگی مدیر فروشگاه را وارد کنید.');
      return;
    }
    if (!phone.trim()) {
      setError('لطفاً شماره تماس معتبر وارد کنید.');
      return;
    }
    if (!username.trim()) {
      setError('لطفاً نام کاربری دلخواه جهت ورود به حساب کاربری را وارد نمایید.');
      return;
    }
    if (!password.trim()) {
      setError('لطفاً رمز عبور را جهت ورود به حساب کاربری وارد نمایید.');
      return;
    }
    if (password.trim().length < 3) {
      setError('رمز عبور باید حداقل ۳ کاراکتر باشد.');
      return;
    }
    if (!address.trim()) {
      setError('لطفاً آدرس دقیق جهت ارسال سفارشات را درج کنید.');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await registerSupermarket({
        name: name.trim(),
        owner: owner.trim(),
        phone: phone.trim(),
        address: address.trim(),
        assigned_visitor_id: assignedVisitorId,
        username: username.trim(),
        password: password.trim(),
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
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden p-6 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 mx-auto flex items-center justify-center shadow-inner">
            <Check className="w-7 h-7 stroke-[3]" />
          </div>

          <div className="space-y-1.5">
            <h3 className="text-base font-bold text-slate-100">حساب کاربری شما با موفقیت ایجاد و فعال شد</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              حساب فروشگاه <strong className="text-amber-400">«{name}»</strong> فعال گردید. اکنون می‌توانید با نام کاربری <strong className="text-amber-300 font-mono">{username}</strong> و رمز عبور تعیین‌شده وارد سامانه شوید.
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

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              نام فروشگاه / سوپرمارکت <span className="text-amber-400">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder=""
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-amber-500 transition"
              />
              <Store className="w-4 h-4 text-slate-500 absolute left-3 top-3 pointer-events-none" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                نام مدیریت یا مسئول <span className="text-amber-400">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder=""
                  value={owner}
                  onChange={(e) => setOwner(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-amber-500 transition"
                />
                <User className="w-4 h-4 text-slate-500 absolute left-3 top-3 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                شماره تلفن همراه <span className="text-amber-400">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  dir="ltr"
                  placeholder=""
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-amber-500 font-mono text-left transition"
                />
                <Phone className="w-4 h-4 text-slate-500 absolute left-3 top-3 pointer-events-none" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                نام کاربری جهت ورود به حساب <span className="text-amber-400">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  dir="ltr"
                  required
                  placeholder=""
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-amber-500 font-mono text-left transition"
                />
                <AtSign className="w-4 h-4 text-slate-500 absolute left-3 top-3 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                رمز عبور حساب <span className="text-amber-400">*</span>
              </label>
              <div className="relative">
                <input
                  type="password"
                  dir="ltr"
                  required
                  placeholder=""
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-amber-500 font-mono text-left transition"
                />
                <KeyRound className="w-4 h-4 text-slate-500 absolute left-3 top-3 pointer-events-none" />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              ویزیتور مسئول یا نحوه خرید <span className="text-slate-400 font-normal">(اختیاری)</span>
            </label>
            <div className="relative">
              <select
                dir="rtl"
                value={assignedVisitorId}
                onChange={(e) => setAssignedVisitorId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pr-3.5 pl-10 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-amber-500 transition appearance-none cursor-pointer text-right"
              >
                <option value="direct" className="bg-slate-900 text-slate-100 py-2 px-3">خرید مستقیم از پخش فرهودی</option>
                {visitors.filter((v) => v.is_active !== false).map((v) => (
                  <option key={v.id} value={v.id} className="bg-slate-900 text-slate-100 py-2 px-3">
                    {v.name} — ({v.region})
                  </option>
                ))}
              </select>
              <Truck className="w-4 h-4 text-slate-500 absolute left-3 top-3.5 pointer-events-none" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              آدرس دقیق فروشگاه <span className="text-amber-400">*</span>
            </label>
            <div className="relative">
              <textarea
                rows={2}
                placeholder=""
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-amber-500 transition resize-none"
              />
              <MapPin className="w-4 h-4 text-slate-500 absolute left-3 top-3 pointer-events-none" />
            </div>
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
