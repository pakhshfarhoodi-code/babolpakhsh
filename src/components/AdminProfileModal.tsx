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
  Sparkles,
  AlertCircle,
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
  const { adminProfile, updateAdminProfile, role } = useApp();
  const isAdmin = role === 'admin';

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
        setFeedback({ type: 'success', message: res.message || 'مشخصات مدیریت و مرکز پخش با موفقیت ذخیره شد.' });
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

  // Check if profile is essentially empty (not yet completed by admin)
  const isProfileEmpty =
    !formData.manager_name &&
    !formData.mobile &&
    !formData.phone &&
    !formData.address;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xs animate-in fade-in">
        <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/85">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-amber-500 p-0.5 shadow-md shadow-blue-500/20 shrink-0">
                <div className="w-full h-full bg-slate-900 rounded-[10px] flex items-center justify-center text-amber-400">
                  <Building2 className="w-5 h-5" />
                </div>
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                  <span>{isEditing ? 'ویرایش اطلاعات مدیریت و مرکز پخش' : 'اطلاعات مدیریت و مرکز پخش'}</span>
                  {formData.business_title && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-extrabold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                      {formData.business_title}
                    </span>
                  )}
                </h3>
                <p className="text-xs text-slate-300 mt-0.5 font-medium">
                  {formData.business_title
                    ? `مرکز پخش و توزیع: ${formData.business_title}`
                    : 'مشخصات ثبت‌شده توسط مدیریت سیستم'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {isAdmin && !isEditing && (
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                  title="ویرایش مشخصات مدیریت"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>ویرایش</span>
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                title="بستن"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Feedback message */}
          {feedback && (
            <div
              className={`m-3 p-3 rounded-xl border text-xs font-bold flex items-center gap-2 animate-in fade-in ${
                feedback.type === 'success'
                  ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-200'
                  : 'bg-rose-500/20 border-rose-500/40 text-rose-200'
              }`}
            >
              {feedback.type === 'success' ? (
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <Info className="w-4 h-4 text-rose-400 shrink-0" />
              )}
              <span>{feedback.message}</span>
            </div>
          )}

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {isEditing ? (
              /* Edit Form (Admin Only) */
              <form id="admin-profile-form" onSubmit={handleSave} className="space-y-3.5 text-xs">
                <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/25 flex items-start gap-2.5 text-blue-200">
                  <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                  <p className="leading-relaxed">
                    اطلاعاتی که در این بخش تکمیل می‌کنید بلافاصله برای تمامی فروشگاه‌ها، مشتریان و ویزیتورها در پنل مربوطه‌شان نمایش داده می‌شود.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-200 font-bold mb-1.5">
                      نام و نام خانوادگی مدیریت <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.manager_name}
                      onChange={(e) => setFormData({ ...formData, manager_name: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                      placeholder="مثال: احمد رضازاده فرهودی"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-200 font-bold mb-1.5">
                      عنوان تجاری مرکز پخش <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.business_title}
                      onChange={(e) => setFormData({ ...formData, business_title: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                      placeholder="مثال: بارفروش | پخش فرهودی"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-200 font-bold mb-1.5">
                      شماره تماس همراه / پشتیبانی <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.mobile}
                      onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono text-left placeholder-slate-500 focus:outline-none focus:border-amber-400"
                      placeholder="مثال: 09111142500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-200 font-bold mb-1.5">
                      شماره تلفن ثابت دفتر مرکزی / انبار
                    </label>
                    <input
                      type="text"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono text-left placeholder-slate-500 focus:outline-none focus:border-amber-400"
                      placeholder="مثال: 01132255000"
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
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                    placeholder="مثال: تامین و توزیع مویرگی زنجیره سرد مواد غذایی"
                  />
                </div>

                <div>
                  <label className="block text-slate-200 font-bold mb-1.5">
                    آدرس دقیق انبار و دفتر مرکزی <span className="text-rose-400">*</span>
                  </label>
                  <textarea
                    rows={2}
                    required
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                    placeholder="مثال: مازندران، بابل، میدان بارفروش، مجتمع پخش و سردخانه فرهودی"
                  />
                </div>

                {/* Location Picker */}
                <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-700 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-200 flex items-center gap-1.5">
                      <MapPin className="w-4 h-4 text-emerald-400" />
                      <span>موقعیت مکانی روی نقشه (جهت مسیریابی مستقیم مشتریان)</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsMapPickerOpen(true)}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600/25 hover:bg-emerald-600/40 text-emerald-200 border border-emerald-500/40 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <Navigation className="w-3.5 h-3.5" />
                      <span>انتخاب از روی نقشه</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5 text-xs">
                    <div>
                      <span className="text-slate-300 font-semibold block mb-1">عرض جغرافیایی (Latitude):</span>
                      <input
                        type="number"
                        step="any"
                        value={formData.latitude ?? ''}
                        onChange={(e) => setFormData({ ...formData, latitude: parseFloat(e.target.value) || undefined })}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono text-left placeholder-slate-500 focus:outline-none focus:border-emerald-400"
                        placeholder="36.5414"
                      />
                    </div>
                    <div>
                      <span className="text-slate-300 font-semibold block mb-1">طول جغرافیایی (Longitude):</span>
                      <input
                        type="number"
                        step="any"
                        value={formData.longitude ?? ''}
                        onChange={(e) => setFormData({ ...formData, longitude: parseFloat(e.target.value) || undefined })}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono text-left placeholder-slate-500 focus:outline-none focus:border-emerald-400"
                        placeholder="52.6841"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-200 font-bold mb-1.5">
                      ساعات کاری و پاسخگویی
                    </label>
                    <input
                      type="text"
                      value={formData.working_hours || ''}
                      onChange={(e) => setFormData({ ...formData, working_hours: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
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
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                      placeholder="مثال: تامین و توزیع مستقیم با تضمین اصالت و سلامت زنجیره سرد"
                    />
                  </div>
                </div>
              </form>
            ) : (
              /* View Mode (Clean, High Contrast, Fully Dynamic) */
              <div className="space-y-4">
                {/* Empty State Warning if Admin hasn't filled anything */}
                {isProfileEmpty && (
                  <div className="p-4 rounded-2xl bg-slate-950 border-2 border-amber-500/60 shadow-lg shadow-black/40 flex items-start gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/50 flex items-center justify-center shrink-0">
                      <AlertCircle className="w-5 h-5 text-amber-400" />
                    </div>
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <h4 className="font-black text-white text-sm sm:text-base tracking-wide">
                        مشخصات مدیریت هنوز تکمیل نشده است
                      </h4>
                      <p className="text-xs sm:text-sm text-slate-200 font-medium leading-relaxed">
                        {isAdmin
                          ? 'شما به عنوان مدیر می‌توانید با کلیک بر روی دکمه «ویرایش» مشخصات تماس، نام، آدرس انبار و موقعیت مکانی را تکمیل نمایید.'
                          : 'مدیریت مرکز پخش به زودی اطلاعات تماس، آدرس انبار و موقعیت جغرافیایی را در این بخش تکمیل خواهد نمود.'}
                      </p>
                    </div>
                  </div>
                )}

                {/* Hero Profile Card */}
                <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-950/80 via-slate-900 to-amber-950/50 border border-blue-500/40 space-y-3 shadow-lg">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-black text-base sm:text-lg text-white">
                          {formData.manager_name || (isAdmin ? 'نام مدیر (ثبت‌نشده)' : 'مدیریت مرکز پخش')}
                        </span>
                        <span className="text-[11px] px-2.5 py-0.5 rounded-full font-extrabold bg-blue-500/25 text-blue-200 border border-blue-400/50">
                          مدیریت ارشد پخش
                        </span>
                      </div>
                      <p className="text-xs sm:text-sm text-amber-300 font-extrabold">
                        {formData.business_title || (isAdmin ? 'عنوان تجاری ثبت‌نشده' : 'مرکز پخش')}
                      </p>
                      {formData.tagline && (
                        <p className="text-xs text-slate-200 font-medium">
                          {formData.tagline}
                        </p>
                      )}
                    </div>

                    <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-300 shrink-0 shadow-inner">
                      <ShieldCheck className="w-6 h-6" />
                    </div>
                  </div>

                  {formData.description && (
                    <div className="pt-2.5 border-t border-slate-700/80 text-xs text-slate-200 leading-relaxed font-normal">
                      {formData.description}
                    </div>
                  )}
                </div>

                {/* Contact Cards Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {/* Mobile Call Card */}
                  {formData.mobile ? (
                    <div className="p-3 rounded-xl bg-slate-800/90 border border-slate-700/90 flex items-center justify-between gap-2 shadow-xs">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-9 h-9 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 flex items-center justify-center shrink-0">
                          <Smartphone className="w-4.5 h-4.5" />
                        </div>
                        <div className="min-w-0">
                          <span className="text-xs font-bold text-slate-300 block">شماره همراه و پشتیبانی:</span>
                          <span className="text-xs sm:text-sm font-black text-white font-mono text-left block truncate mt-0.5">
                            {formData.mobile}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleCopy(formData.mobile, 'mobile')}
                          className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white border border-slate-600 transition cursor-pointer"
                          title="کپی شماره همراه"
                        >
                          {copiedKey === 'mobile' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                        <a
                          href={`tel:${formData.mobile}`}
                          className="p-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition shadow-sm cursor-pointer"
                          title="تماس مستقیم"
                        >
                          <Phone className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-700/80 flex items-center gap-2.5 text-xs text-slate-200 font-medium">
                      <Smartphone className="w-4 h-4 text-amber-400" />
                      <span>شماره همراه ثبت نشده است.</span>
                    </div>
                  )}

                  {/* Telephone Landline Card */}
                  {formData.phone ? (
                    <div className="p-3 rounded-xl bg-slate-800/90 border border-slate-700/90 flex items-center justify-between gap-2 shadow-xs">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-9 h-9 rounded-lg bg-blue-500/20 border border-blue-500/40 text-blue-300 flex items-center justify-center shrink-0">
                          <Phone className="w-4.5 h-4.5" />
                        </div>
                        <div className="min-w-0">
                          <span className="text-xs font-bold text-slate-300 block">تلفن ثابت دفتر مرکزی:</span>
                          <span className="text-xs sm:text-sm font-black text-white font-mono text-left block truncate mt-0.5">
                            {formData.phone}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleCopy(formData.phone, 'phone')}
                          className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white border border-slate-600 transition cursor-pointer"
                          title="کپی شماره ثابت"
                        >
                          {copiedKey === 'phone' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                        <a
                          href={`tel:${formData.phone}`}
                          className="p-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition shadow-sm cursor-pointer"
                          title="تماس تلفنی"
                        >
                          <Phone className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-700/80 flex items-center gap-2.5 text-xs text-slate-200 font-medium">
                      <Phone className="w-4 h-4 text-blue-400" />
                      <span>تلفن ثابت دفتر ثبت نشده است.</span>
                    </div>
                  )}
                </div>

                {/* Working Hours */}
                {formData.working_hours && (
                  <div className="p-3 rounded-xl bg-slate-800/90 border border-slate-700/80 flex items-center gap-2.5 text-xs shadow-xs">
                    <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-slate-300 font-bold">ساعات کاری و پاسخگویی:</span>
                      <span className="font-extrabold text-amber-300">{formData.working_hours}</span>
                    </div>
                  </div>
                )}

                {/* Warehouse Address & Navigation Card (Redesigned with Premium Contrast and Visual Appeal) */}
                <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-850 via-slate-900 to-blue-950/50 border-2 border-amber-500/35 shadow-xl shadow-black/30 space-y-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500/25 to-rose-500/20 border border-amber-500/40 text-amber-300 flex items-center justify-center shrink-0 shadow-inner mt-0.5">
                        <MapPin className="w-5 h-5 text-amber-300" />
                      </div>
                      <div>
                        <span className="text-xs font-extrabold text-amber-300 block tracking-wide">
                          آدرس دقیق انبار و دفتر مرکزی:
                        </span>
                        <p className="text-xs sm:text-sm font-bold text-white mt-1 leading-relaxed">
                          {formData.address || (isAdmin ? 'آدرس هنوز ثبت نشده است (جهت ثبت دکمه ویرایش را بزنید).' : 'آدرس انبار هنوز توسط مدیریت ثبت نشده است.')}
                        </p>
                      </div>
                    </div>

                    {formData.address && (
                      <button
                        type="button"
                        onClick={() => handleCopy(formData.address, 'address')}
                        className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white border border-slate-600 transition cursor-pointer shrink-0 shadow-xs"
                        title="کپی آدرس دقیق"
                      >
                        {copiedKey === 'address' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                      </button>
                    )}
                  </div>

                  {/* Navigation Links (Only shown when actual coordinates exist) */}
                  {hasCoordinates ? (
                    <div className="pt-3 border-t border-slate-700/80 flex items-center justify-between gap-2.5 flex-wrap text-xs">
                      <span className="text-xs text-emerald-300 font-extrabold flex items-center gap-1.5">
                        <Navigation className="w-4 h-4 text-emerald-400" />
                        <span>مسیریابی مستقیم به انبار:</span>
                      </span>

                      <div className="flex items-center gap-2 flex-wrap">
                        <a
                          href={`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`}
                          target="_blank"
                          rel="noreferrer"
                          className="px-2.5 py-1.5 rounded-xl bg-blue-600/30 hover:bg-blue-600/50 text-blue-100 border border-blue-400/50 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                        >
                          <span>گوگل مپ</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>

                        <a
                          href={`https://nshn.ir/?lat=${lat}&lng=${lng}`}
                          target="_blank"
                          rel="noreferrer"
                          className="px-2.5 py-1.5 rounded-xl bg-teal-600/30 hover:bg-teal-600/50 text-teal-100 border border-teal-400/50 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                        >
                          <span>نشان</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>

                        <a
                          href={`https://balad.ir/location?latitude=${lat}&longitude=${lng}`}
                          target="_blank"
                          rel="noreferrer"
                          className="px-2.5 py-1.5 rounded-xl bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-100 border border-emerald-400/50 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                        >
                          <span>بلد</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>

                        <a
                          href={`https://waze.com/ul?ll=${lat},${lng}&navigate=yes`}
                          target="_blank"
                          rel="noreferrer"
                          className="px-2.5 py-1.5 rounded-xl bg-cyan-600/30 hover:bg-cyan-600/50 text-cyan-100 border border-cyan-400/50 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                        >
                          <span>ویز</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </div>
                  ) : (
                    <div className="pt-3 border-t border-slate-700/80 flex items-center justify-between gap-2.5 flex-wrap">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-rose-400 shrink-0" />
                        <span className="text-xs sm:text-sm font-bold text-amber-200">
                          لوکیشن نقشه برای مسیریابی هنوز توسط مدیر تعیین نشده است.
                        </span>
                      </div>
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => setIsEditing(true)}
                          className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition shadow-sm cursor-pointer"
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
          <div className="p-3.5 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between gap-2">
            {isEditing ? (
              <>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  form="admin-profile-form"
                  disabled={isSaving}
                  className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 active:scale-95 text-white text-xs font-bold transition shadow-md shadow-amber-600/30 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{isSaving ? 'در حال ذخیره‌سازی...' : 'ذخیره مشخصات مدیر'}</span>
                </button>
              </>
            ) : (
              <div className="w-full flex items-center justify-between">
                <span className="text-xs text-slate-300 font-semibold flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>{formData.business_title || 'مرکز پخش و توزیع'}</span>
                </span>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition cursor-pointer"
                >
                  بستن
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Location Picker Modal for Admin Location */}
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
