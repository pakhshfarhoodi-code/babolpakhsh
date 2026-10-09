import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { AdminProfile } from '../types';
import { LocationPickerModal } from './LocationPickerModal';
import {
  Building2,
  X,
  Phone,
  Smartphone,
  MapPin,
  Clock,
  Navigation,
  Copy,
  Check,
  Edit3,
  Save,
  ShieldCheck,
  ExternalLink,
  Info,
  AlertCircle,
  RotateCcw,
} from 'lucide-react';

interface AdminProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialEditMode?: boolean;
}

export const AdminProfileModal: React.FC<AdminProfileModalProps> = ({
  isOpen,
  onClose,
  initialEditMode = false,
}) => {
  const { adminProfile, updateAdminProfile, role, theme } = useApp();
  const isAdmin = role === 'admin';
  const isLight = theme === 'light';

  const [isEditing, setIsEditing] = useState(initialEditMode && isAdmin);
  const [formData, setFormData] = useState<AdminProfile>(adminProfile);
  const [isSaving, setIsSaving] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isMapPickerOpen, setIsMapPickerOpen] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setFormData(adminProfile);
      setIsEditing(initialEditMode && isAdmin);
      setFeedback(null);
    }
  }, [isOpen, adminProfile, initialEditMode, isAdmin]);

  if (!isOpen) return null;

  const handleCopy = (text: string | undefined, key: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    setIsSaving(true);
    setFeedback(null);
    try {
      const res = await updateAdminProfile(formData);
      if (res.success) {
        setFeedback({ type: 'success', message: res.message || 'مشخصات مدیریت و مرکز پخش با موفقیت ثبت شد.' });
        setIsEditing(false);
      } else {
        setFeedback({ type: 'error', message: res.message || 'خطا در ذخیره‌سازی اطلاعات' });
      }
    } catch {
      setFeedback({ type: 'error', message: 'خطای غیرمنتظره در ثبت مشخصات' });
    } finally {
      setIsSaving(false);
    }
  };

  const hasCoordinates = Boolean(
    typeof formData.latitude === 'number' &&
    typeof formData.longitude === 'number' &&
    !isNaN(formData.latitude) &&
    !isNaN(formData.longitude)
  );

  const lat = formData.latitude ?? 36.5414;
  const lng = formData.longitude ?? 52.6841;

  // Check if profile is essentially empty
  const isProfileEmpty =
    !formData.manager_name &&
    !formData.mobile &&
    !formData.phone &&
    !formData.address;

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/75 backdrop-blur-xs animate-in fade-in"
        onClick={onClose}
      >
        <div
          className="admin-profile-modal rounded-2xl sm:rounded-3xl border border-slate-800 w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-slate-800/80 bg-slate-950/40 flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-blue-600/10 border border-blue-500/25 flex items-center justify-center text-blue-500 dark:text-blue-400 shrink-0">
                <Building2 className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm sm:text-base font-bold text-slate-100 truncate">
                  {isEditing ? 'ویرایش مشخصات مدیریت و مرکز پخش' : 'اطلاعات مدیریت و مرکز پخش'}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5 truncate font-medium">
                  {formData.business_title
                    ? `مرکز توزیع · ${formData.business_title}`
                    : 'سامانه مرکزی تامین و پخش مویرگی'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {isAdmin && !isEditing && (
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="px-3 py-1.5 rounded-xl bg-blue-600/10 hover:bg-blue-600/20 text-blue-600 dark:text-blue-400 border border-blue-500/25 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  title="ویرایش اطلاعات"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>ویرایش</span>
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-slate-800/60 transition cursor-pointer"
                title="بستن پنجره"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Feedback message banner with crystal clear contrast */}
          {feedback && (
            <div
              className={`mx-4 sm:mx-5 mt-4 p-3 rounded-xl border text-xs font-bold flex items-center gap-2.5 animate-in fade-in ${
                feedback.type === 'success'
                  ? isLight
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                    : 'bg-emerald-950/60 border-emerald-800 text-emerald-300'
                  : isLight
                    ? 'bg-rose-50 border-rose-300 text-rose-900'
                    : 'bg-rose-950/60 border-rose-800 text-rose-300'
              }`}
            >
              {feedback.type === 'success' ? (
                <Check className={`w-4 h-4 shrink-0 ${isLight ? 'text-emerald-700' : 'text-emerald-400'}`} />
              ) : (
                <AlertCircle className={`w-4 h-4 shrink-0 ${isLight ? 'text-rose-700' : 'text-rose-400'}`} />
              )}
              <span>{feedback.message}</span>
            </div>
          )}

          {/* Modal Body */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
            {isEditing ? (
              /* Edit Form (Admin Only) */
              <form id="admin-profile-form" onSubmit={handleSave} className="space-y-4 text-xs">
                <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-start gap-2.5 text-blue-700 dark:text-blue-300">
                  <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                  <p className="leading-relaxed">
                    اطلاعات ثبت‌شده در این فرم در سربرگ فاکتورها، پروفایل مشتریان و پنل اختصاصی ویزیتورها منعکس می‌گردد.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-slate-200 font-bold mb-1.5">
                      نام و نام خانوادگی مدیریت <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.manager_name}
                      onChange={(e) => setFormData({ ...formData, manager_name: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500 transition"
                      placeholder="مثال: احمدرضا فرهودی"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-200 font-bold mb-1.5">
                      عنوان تجاری مرکز پخش <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.business_title}
                      onChange={(e) => setFormData({ ...formData, business_title: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500 transition"
                      placeholder="مثال: بارفروش | پخش فرهودی"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-slate-200 font-bold mb-1.5">
                      شماره همراه و پشتیبانی <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.mobile}
                      onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 font-mono text-left placeholder:text-slate-500 focus:outline-none focus:border-blue-500 transition dir-ltr"
                      placeholder="0911..."
                    />
                  </div>

                  <div>
                    <label className="block text-slate-200 font-bold mb-1.5">
                      شماره تلفن ثابت دفتر مرکزی
                    </label>
                    <input
                      type="text"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 font-mono text-left placeholder:text-slate-500 focus:outline-none focus:border-blue-500 transition dir-ltr"
                      placeholder="011..."
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-200 font-bold mb-1.5">
                    شعار یا حوزه فعالیت مرکز پخش
                  </label>
                  <input
                    type="text"
                    value={formData.tagline || ''}
                    onChange={(e) => setFormData({ ...formData, tagline: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500 transition"
                    placeholder="مثال: تامین و توزیع مویرگی زنجیره سرد مواد غذایی"
                  />
                </div>

                <div>
                  <label className="block text-slate-200 font-bold mb-1.5">
                    آدرس دقیق انبار و دفتر مرکزی <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    rows={2}
                    required
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500 transition resize-none"
                    placeholder="مازندران، بابل، پل محمدحسن خان..."
                  />
                </div>

                {/* Map Location Section */}
                <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="font-bold text-slate-200 flex items-center gap-1.5">
                      <MapPin className="w-4 h-4 text-rose-500" />
                      <span>موقعیت مکانی روی نقشه (جهت مسیریابی مشتریان)</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsMapPickerOpen(true)}
                      className="px-3 py-1.5 rounded-xl bg-blue-600/15 hover:bg-blue-600/25 text-blue-600 dark:text-blue-400 border border-blue-500/30 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                    >
                      <Navigation className="w-3.5 h-3.5" />
                      <span>انتخاب از روی نقشه</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-slate-400 font-semibold block mb-1">عرض جغرافیایی (Latitude):</span>
                      <input
                        type="number"
                        step="any"
                        value={formData.latitude ?? ''}
                        onChange={(e) => setFormData({ ...formData, latitude: parseFloat(e.target.value) || undefined })}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-slate-100 font-mono text-left placeholder:text-slate-500 focus:outline-none focus:border-blue-500 dir-ltr"
                        placeholder="36.5414"
                      />
                    </div>
                    <div>
                      <span className="text-slate-400 font-semibold block mb-1">طول جغرافیایی (Longitude):</span>
                      <input
                        type="number"
                        step="any"
                        value={formData.longitude ?? ''}
                        onChange={(e) => setFormData({ ...formData, longitude: parseFloat(e.target.value) || undefined })}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-slate-100 font-mono text-left placeholder:text-slate-500 focus:outline-none focus:border-blue-500 dir-ltr"
                        placeholder="52.6841"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-slate-200 font-bold mb-1.5">
                      ساعات کاری و پاسخگویی
                    </label>
                    <input
                      type="text"
                      value={formData.working_hours || ''}
                      onChange={(e) => setFormData({ ...formData, working_hours: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500 transition"
                      placeholder="مثال: شنبه تا پنج‌شنبه: ۸:۰۰ الی ۱۸:۰۰"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-200 font-bold mb-1.5">
                      توضیحات و پیام مدیریت به فروشگاه‌ها
                    </label>
                    <input
                      type="text"
                      value={formData.description || ''}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500 transition"
                      placeholder="مثال: تامین مستقیم با تضمین زنجیره سرد"
                    />
                  </div>
                </div>
              </form>
            ) : (
              /* View Mode (Clean, Executive, Harmonious Aesthetic) */
              <div className="space-y-4">
                {/* Empty State Warning if Admin hasn't filled anything */}
                {isProfileEmpty && (
                  <div className="p-4 rounded-2xl bg-slate-950/60 border border-amber-500/40 flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0 text-amber-500">
                      <AlertCircle className="w-5 h-5" />
                    </div>
                    <div className="space-y-1 flex-1 min-w-0">
                      <h4 className="font-bold text-slate-100 text-sm">
                        مشخصات مدیریت هنوز تکمیل نشده است
                      </h4>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        {isAdmin
                          ? 'جهت درج نام، شماره تماس مستقیم، آدرس انبار و موقعیت جغرافیایی روی دکمه «ویرایش» کلیک فرمایید.'
                          : 'مشخصات تماس و آدرس انبار توسط مدیریت سیستم به زودی به‌روزرسانی خواهد شد.'}
                      </p>
                    </div>
                  </div>
                )}

                {/* 1. Identity & Management Card */}
                <div className="p-4 sm:p-5 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <span className="font-black text-base sm:text-lg text-slate-100">
                          {formData.manager_name || (isAdmin ? 'نام مدیر (ثبت نشده)' : 'مدیریت مرکز پخش')}
                        </span>
                        <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
                          <span className="text-blue-600 dark:text-blue-400 font-bold">مدیریت ارشد پخش</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-semibold text-slate-200">
                            {formData.business_title || (isAdmin ? 'عنوان تجاری ثبت‌نشده' : 'مرکز پخش')}
                          </span>
                        </div>
                      </div>

                      {formData.tagline && (
                        <p className="text-xs text-slate-400 leading-relaxed pt-0.5">
                          {formData.tagline}
                        </p>
                      )}
                    </div>

                    <div className="w-11 h-11 rounded-xl bg-blue-600/10 border border-blue-500/25 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0 shadow-2xs">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                  </div>

                  {formData.description && (
                    <div className="pt-3 border-t border-slate-800/80 text-xs text-slate-300 leading-relaxed font-normal">
                      {formData.description}
                    </div>
                  )}
                </div>

                {/* 2. Symmetrical Contact Cards Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Mobile Phone Card */}
                  <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 flex items-center justify-between gap-2.5">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                        <Smartphone className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <span className="text-[11px] font-bold text-slate-400 block">شماره همراه و پشتیبانی</span>
                        {formData.mobile ? (
                          <span className="text-xs sm:text-sm font-bold text-slate-100 font-mono tracking-wide block truncate mt-0.5 dir-ltr text-right">
                            {formData.mobile}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-500 block mt-0.5">ثبت نشده است</span>
                        )}
                      </div>
                    </div>

                    {formData.mobile && (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleCopy(formData.mobile, 'mobile')}
                          className="p-2 rounded-xl bg-slate-800/70 hover:bg-slate-700/80 text-slate-300 hover:text-slate-100 border border-slate-700/60 transition cursor-pointer"
                          title="کپی شماره همراه"
                        >
                          {copiedKey === 'mobile' ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                        </button>
                        <a
                          href={`tel:${formData.mobile}`}
                          className="p-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white transition shadow-xs cursor-pointer"
                          title="تماس مستقیم"
                        >
                          <Phone className="w-4 h-4" />
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Telephone Landline Card */}
                  <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 flex items-center justify-between gap-2.5">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-blue-600/10 border border-blue-500/25 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                        <Phone className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <span className="text-[11px] font-bold text-slate-400 block">تلفن ثابت دفتر مرکزی</span>
                        {formData.phone ? (
                          <span className="text-xs sm:text-sm font-bold text-slate-100 font-mono tracking-wide block truncate mt-0.5 dir-ltr text-right">
                            {formData.phone}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-500 block mt-0.5">ثبت نشده است</span>
                        )}
                      </div>
                    </div>

                    {formData.phone && (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleCopy(formData.phone, 'phone')}
                          className="p-2 rounded-xl bg-slate-800/70 hover:bg-slate-700/80 text-slate-300 hover:text-slate-100 border border-slate-700/60 transition cursor-pointer"
                          title="کپی شماره ثابت"
                        >
                          {copiedKey === 'phone' ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                        </button>
                        <a
                          href={`tel:${formData.phone}`}
                          className="p-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white transition shadow-xs cursor-pointer"
                          title="تماس تلفنی"
                        >
                          <Phone className="w-4 h-4" />
                        </a>
                      </div>
                    )}
                  </div>
                </div>

                {/* 3. Working Hours Card (if present) */}
                {formData.working_hours && (
                  <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 flex items-center gap-3 text-xs">
                    <div className="w-9 h-9 rounded-xl bg-slate-800/70 border border-slate-700/60 text-slate-300 flex items-center justify-center shrink-0">
                      <Clock className="w-4 h-4" />
                    </div>
                    <div className="flex items-center gap-2 flex-wrap min-w-0">
                      <span className="text-slate-400 font-bold">ساعات کاری و پاسخگویی:</span>
                      <span className="font-bold text-slate-100">{formData.working_hours}</span>
                    </div>
                  </div>
                )}

                {/* 4. Warehouse Location & Navigation Card */}
                <div className="p-4 sm:p-5 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-500 flex items-center justify-center shrink-0 mt-0.5">
                        <MapPin className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <span className="text-xs font-bold text-slate-400 block">
                          آدرس دقیق انبار و دفتر مرکزی:
                        </span>
                        <p className="text-xs sm:text-sm font-bold text-slate-100 mt-1 leading-relaxed">
                          {formData.address || (isAdmin ? 'آدرس هنوز ثبت نشده است (جهت ثبت دکمه ویرایش را بزنید).' : 'آدرس انبار هنوز ثبت نشده است.')}
                        </p>
                      </div>
                    </div>

                    {formData.address && (
                      <button
                        type="button"
                        onClick={() => handleCopy(formData.address, 'address')}
                        className="p-2 rounded-xl bg-slate-800/70 hover:bg-slate-700/80 text-slate-300 hover:text-slate-100 border border-slate-700/60 transition cursor-pointer shrink-0"
                        title="کپی آدرس دقیق"
                      >
                        {copiedKey === 'address' ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                      </button>
                    )}
                  </div>

                  {/* Cohesive Navigation Strip */}
                  {hasCoordinates ? (
                    <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2.5 flex-wrap text-xs">
                      <span className="text-xs text-slate-400 font-bold flex items-center gap-1.5">
                        <Navigation className="w-4 h-4 text-blue-500" />
                        <span>مسیریابی مستقیم:</span>
                      </span>

                      <div className="flex items-center gap-2 flex-wrap">
                        <a
                          href={`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`}
                          target="_blank"
                          rel="noreferrer"
                          className="admin-profile-nav-btn px-3 py-1.5 rounded-xl border text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                        >
                          <span>گوگل مپ</span>
                          <ExternalLink className="w-3.5 h-3.5 opacity-70" />
                        </a>

                        <a
                          href={`https://nshn.ir/?lat=${lat}&lng=${lng}`}
                          target="_blank"
                          rel="noreferrer"
                          className="admin-profile-nav-btn px-3 py-1.5 rounded-xl border text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                        >
                          <span>نشان</span>
                          <ExternalLink className="w-3.5 h-3.5 opacity-70" />
                        </a>

                        <a
                          href={`https://balad.ir/location?latitude=${lat}&longitude=${lng}`}
                          target="_blank"
                          rel="noreferrer"
                          className="admin-profile-nav-btn px-3 py-1.5 rounded-xl border text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                        >
                          <span>بلد</span>
                          <ExternalLink className="w-3.5 h-3.5 opacity-70" />
                        </a>

                        <a
                          href={`https://waze.com/ul?ll=${lat},${lng}&navigate=yes`}
                          target="_blank"
                          rel="noreferrer"
                          className="admin-profile-nav-btn px-3 py-1.5 rounded-xl border text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                        >
                          <span>ویز</span>
                          <ExternalLink className="w-3.5 h-3.5 opacity-70" />
                        </a>
                      </div>
                    </div>
                  ) : (
                    <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2.5 flex-wrap text-xs">
                      <span className="text-slate-400 font-medium">
                        موقعیت جغرافیایی روی نقشه برای مسیریابی ثبت نشده است.
                      </span>
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => setIsEditing(true)}
                          className="px-3 py-1.5 rounded-xl bg-blue-600/10 hover:bg-blue-600/20 text-blue-600 dark:text-blue-400 border border-blue-500/25 font-bold text-xs transition cursor-pointer"
                        >
                          تعیین لوکیشن انبار
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-3.5 sm:p-4 border-t border-slate-800/80 bg-slate-950/40 flex items-center justify-between gap-3">
            {isEditing ? (
              <>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 hover:text-slate-100 text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>انصراف</span>
                </button>
                <button
                  type="submit"
                  form="admin-profile-form"
                  disabled={isSaving}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition shadow-md shadow-blue-600/25 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{isSaving ? 'در حال ذخیره‌سازی...' : 'ذخیره مشخصات'}</span>
                </button>
              </>
            ) : (
              <div className="w-full flex items-center justify-between">
                <span className="text-xs text-slate-400 font-medium truncate">
                  {formData.business_title ? `مرکز پخش و توزیع: ${formData.business_title}` : 'سامانه جامع پخش و توزیع'}
                </span>
                <button
                  type="button"
                  onClick={onClose}
                  className="admin-profile-close-btn px-6 py-2 rounded-xl text-xs font-bold transition cursor-pointer shadow-xs"
                >
                  بستن
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Map Picker Modal */}
      {isMapPickerOpen && (
        <LocationPickerModal
          isOpen={isMapPickerOpen}
          onClose={() => setIsMapPickerOpen(false)}
          initial={{
            lat: formData.latitude ?? 36.5414,
            lng: formData.longitude ?? 52.6841,
          }}
          onConfirm={(selectedLat, selectedLng) => {
            setFormData((prev) => ({
              ...prev,
              latitude: selectedLat,
              longitude: selectedLng,
            }));
            setIsMapPickerOpen(false);
          }}
        />
      )}
    </>
  );
};
