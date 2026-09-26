import React, { useState, useMemo } from 'react';
import { Visitor, Supermarket, Order } from '../../types';
import { useApp } from '../../context/AppContext';
import {
  Truck,
  Users,
  Store,
  Phone,
  MapPin,
  UserPlus,
  Search,
  Filter,
  ArrowRightLeft,
  X,
  UserCheck,
  Loader2,
  AlertCircle,
  CheckCircle2,
  KeyRound,
  AtSign,
  ShieldCheck,
} from 'lucide-react';
import { SupermarketRegisterModal } from '../SupermarketRegisterModal';

interface TeamTabProps {
  visitors: Visitor[];
  supermarkets: Supermarket[];
  orders: Order[];
}

export const TeamTab: React.FC<TeamTabProps> = ({
  visitors,
  supermarkets,
  orders,
}) => {
  const { createStaffAccount } = useApp();
  const [selectedVisitorFilter, setSelectedVisitorFilter] = useState<string | null>(null);
  const [storeSearchTerm, setStoreSearchTerm] = useState('');
  const [isRegisterStoreModalOpen, setIsRegisterStoreModalOpen] = useState(false);

  // Staff Account Creation State
  const [isAddStaffOpen, setIsAddStaffOpen] = useState(false);
  const [isSubmittingStaff, setIsSubmittingStaff] = useState(false);
  const [staffError, setStaffError] = useState<string | null>(null);
  const [staffSuccess, setStaffSuccess] = useState<string | null>(null);
  const [staffForm, setStaffForm] = useState<{
    name: string;
    phone: string;
    role: 'warehouse' | 'visitor';
    region: string;
    username: string;
    password: string;
  }>({
    name: '',
    phone: '',
    role: 'visitor',
    region: '',
    username: '',
    password: '',
  });

  const handleStaffSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStaffError(null);
    setStaffSuccess(null);

    const name = staffForm.name.trim();
    const phone = staffForm.phone.trim();
    const role = staffForm.role;
    const region = staffForm.region.trim();
    const username = staffForm.username.trim();
    const password = staffForm.password;

    if (!name) {
      setStaffError('لطفاً نام و نام خانوادگی عضو تیم را وارد کنید.');
      return;
    }
    if (!phone) {
      setStaffError('لطفاً شماره تماس را وارد کنید.');
      return;
    }
    if (role === 'visitor' && !region) {
      setStaffError('لطفاً منطقه فعالیت ویزیتور را مشخص کنید.');
      return;
    }
    if (!username) {
      setStaffError('لطفاً نام کاربری را وارد کنید.');
      return;
    }
    if (password.length < 6) {
      setStaffError('رمز عبور باید حداقل ۶ کاراکتر باشد.');
      return;
    }

    setIsSubmittingStaff(true);
    try {
      const res = await createStaffAccount({
        name,
        phone,
        role,
        region: role === 'visitor' ? region : undefined,
        username,
        password,
      });

      if (!res.success) {
        setStaffError(res.error || 'خطا در ایجاد حساب کاربری.');
      } else {
        const successMsg = `حساب با نام کاربری ${res.username || username} ساخته شد.`;
        setStaffSuccess(successMsg);
        setTimeout(() => {
          setIsAddStaffOpen(false);
          setStaffForm({
            name: '',
            phone: '',
            role: 'visitor',
            region: '',
            username: '',
            password: '',
          });
          setStaffSuccess(null);
        }, 1500);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'خطای پیش‌بینی نشده در ساخت حساب';
      setStaffError(msg);
    } finally {
      setIsSubmittingStaff(false);
    }
  };

  // Filtered supermarkets based on visitor click and search term
  const filteredSupermarkets = useMemo(() => {
    return supermarkets.filter((shop) => {
      if (selectedVisitorFilter && shop.assigned_visitor_id !== selectedVisitorFilter) {
        return false;
      }
      if (storeSearchTerm.trim()) {
        const term = storeSearchTerm.toLowerCase().trim();
        const matchName = shop.name.toLowerCase().includes(term);
        const matchOwner = shop.owner.toLowerCase().includes(term);
        const matchAddress = shop.address.toLowerCase().includes(term);
        const matchPhone = shop.phone.includes(term);
        if (!matchName && !matchOwner && !matchAddress && !matchPhone) return false;
      }
      return true;
    });
  }, [supermarkets, selectedVisitorFilter, storeSearchTerm]);

  const activeFilteredVisitor = visitors.find((v) => v.id === selectedVisitorFilter);

  return (
    <div className="space-y-6">
      {/* 2-Column Grid: Left Visitors Team, Right Supermarkets */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Visitors Column */}
        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-4 space-y-4 shadow-sm">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-blue-500/15 text-blue-400 flex items-center justify-center border border-blue-500/30">
                <Truck className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-100">تیم ویزیتورها و ناوگان مویرگی</h3>
                <p className="text-xs text-slate-400 mt-0.5">{visitors.length} ویزیتور فعال</p>
              </div>
            </div>

            {/* Add Team Member Button */}
            <button
              type="button"
              onClick={() => {
                setStaffError(null);
                setStaffSuccess(null);
                setIsAddStaffOpen(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-95 text-white text-xs font-bold transition shadow-md shadow-blue-600/30 cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>+ افزودن عضو تیم</span>
            </button>
          </div>

          {/* Visitor Cards */}
          <div className="space-y-3">
            {visitors.map((visitor) => {
              const assignedStores = supermarkets.filter((s) => s.assigned_visitor_id === visitor.id);
              const visitorOrders = orders.filter((o) => o.assigned_visitor_id === visitor.id);
              const isSelected = selectedVisitorFilter === visitor.id;

              return (
                <div
                  key={visitor.id}
                  className={`p-3.5 rounded-xl border transition shadow-xs ${
                    isSelected
                      ? 'bg-blue-950/40 border-blue-500/50'
                      : 'bg-slate-950 border-slate-800/80 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-100">{visitor.name}</span>
                        <span className="text-xs px-2 py-0.5 rounded-md bg-blue-900/50 text-blue-300 border border-blue-800/50">
                          {visitor.region}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1 font-mono">{visitor.phone}</p>
                    </div>

                    <div className="text-left space-y-0.5">
                      <span className="text-xs font-bold text-slate-200">
                        {assignedStores.length} فروشگاه
                      </span>
                      <p className="text-xs text-slate-400">
                        {visitorOrders.length} سفارش جاری
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-slate-900 flex items-center justify-between text-xs">
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedVisitorFilter(isSelected ? null : visitor.id)
                      }
                      className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                        isSelected
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'bg-slate-900 hover:bg-slate-800 text-blue-400 border border-slate-800'
                      }`}
                    >
                      <Store className="w-3.5 h-3.5" />
                      <span>
                        {isSelected ? 'حذف فیلتر و نمایش همه' : 'مشاهده فروشگاه‌های این ویزیتور'}
                      </span>
                    </button>

                    <button
                      type="button"
                      disabled
                      title="ویرایش ویزیتور در آپدیت بعدی فعال خواهد شد"
                      className="text-slate-500 hover:text-slate-400 cursor-not-allowed text-xs"
                    >
                      ویرایش ویزیتور
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Supermarkets Column */}
        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-4 space-y-4 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-purple-500/15 text-purple-400 flex items-center justify-center border border-purple-500/30">
                  <Store className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-100">فهرست سوپرمارکت‌های طرف قرارداد</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {filteredSupermarkets.length} از {supermarkets.length} فروشگاه
                  </p>
                </div>
              </div>

              {/* Add Store Button */}
              <button
                type="button"
                onClick={() => setIsRegisterStoreModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-95 text-white text-xs font-bold transition shadow-md shadow-blue-600/30 cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>+ ثبت فروشگاه جدید</span>
              </button>
            </div>

            {/* Filter banner if active */}
            {activeFilteredVisitor && (
              <div className="mt-3 p-2.5 rounded-xl bg-blue-950/60 border border-blue-800/60 text-xs flex items-center justify-between">
                <span className="text-blue-200">
                  در حال نمایش فروشگاه‌های ویزیتور:{' '}
                  <strong>{activeFilteredVisitor.name}</strong> ({activeFilteredVisitor.region})
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedVisitorFilter(null)}
                  className="p-1 text-slate-400 hover:text-slate-100 rounded-md cursor-pointer"
                  title="نمایش همه فروشگاه‌ها"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Store search box */}
            <div className="relative mt-3">
              <Search className="w-4 h-4 absolute right-3 top-2.5 text-slate-500 pointer-events-none" />
              <input
                type="text"
                value={storeSearchTerm}
                onChange={(e) => setStoreSearchTerm(e.target.value)}
                placeholder="جستجوی نام فروشگاه، مالک، آدرس یا تلفن..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pr-9 pl-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Supermarket Cards List */}
            <div className="space-y-3 mt-3 max-h-[500px] overflow-y-auto pr-1">
              {filteredSupermarkets.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-xs">
                  فروشگاهی مطابق با فیلتر یافت نشد.
                </div>
              ) : (
                filteredSupermarkets.map((shop) => {
                  const assignedVisitor = visitors.find((v) => v.id === shop.assigned_visitor_id);

                  return (
                    <div
                      key={shop.id}
                      className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 space-y-2 text-xs"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-bold text-sm text-slate-100">{shop.name}</p>
                          <p className="text-slate-400 mt-0.5">مدیریت: {shop.owner}</p>
                        </div>
                        <span className="px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800 text-slate-400 font-mono text-xs">
                          {shop.phone}
                        </span>
                      </div>

                      <div className="flex items-start gap-1.5 text-slate-400 pt-1">
                        <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                        <span className="truncate">{shop.address}</span>
                      </div>

                      {/* Bottom row: Assigned Visitor select + Toggle store */}
                      <div className="mt-2.5 pt-2 border-t border-slate-900 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-500">ویزیتور:</span>
                          <select
                            disabled
                            title="تغییر مستقیم ویزیتور فروشگاه نیازمند متد reassignSupermarketVisitor در کانتکست است"
                            value={shop.assigned_visitor_id}
                            className="bg-slate-900 border border-slate-800 text-slate-300 rounded-lg px-2 py-1 text-xs cursor-not-allowed opacity-80"
                          >
                            <option value={shop.assigned_visitor_id}>
                              {assignedVisitor ? `${assignedVisitor.name} (${assignedVisitor.region})` : 'تعیین نشده'}
                            </option>
                          </select>
                        </div>

                        <button
                          type="button"
                          disabled
                          title="فعال/غیرفعال‌سازی فروشگاه نیازمند متد setSupermarketActive در کانتکست است"
                          className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-xs cursor-not-allowed opacity-80"
                        >
                          فعال
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Supermarket Register Modal */}
      <SupermarketRegisterModal
        isOpen={isRegisterStoreModalOpen}
        onClose={() => setIsRegisterStoreModalOpen(false)}
      />

      {/* Add Staff Account Modal */}
      {isAddStaffOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950/60">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-500/15 text-blue-400 flex items-center justify-center border border-blue-500/30">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-100">افزودن عضو جدید تیم</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    ایجاد حساب احراز هویت رسمی (ویزیتور یا انباردار)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!isSubmittingStaff) {
                    setIsAddStaffOpen(false);
                    setStaffError(null);
                    setStaffSuccess(null);
                  }
                }}
                disabled={isSubmittingStaff}
                className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition disabled:opacity-50 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <form onSubmit={handleStaffSubmit} className="p-5 space-y-4 overflow-y-auto">
              {staffSuccess && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center gap-2 text-xs text-emerald-400">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{staffSuccess}</span>
                </div>
              )}

              {staffError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center gap-2 text-xs text-rose-400">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{staffError}</span>
                </div>
              )}

              {/* Role selection */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  نقش سازمانی <span className="text-rose-400">*</span>
                </label>
                <select
                  value={staffForm.role}
                  onChange={(e) =>
                    setStaffForm((prev) => ({
                      ...prev,
                      role: e.target.value as 'warehouse' | 'visitor',
                    }))
                  }
                  disabled={isSubmittingStaff}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                >
                  <option value="visitor">ویزیتور (پخش و بازاریابی مویرگی)</option>
                  <option value="warehouse">انباردار (مدیریت سردخانه و موجودی)</option>
                </select>
              </div>

              {/* Name & Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    نام و نام خانوادگی <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={staffForm.name}
                    onChange={(e) => setStaffForm((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="مثال: حمید اکبری"
                    disabled={isSubmittingStaff}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                    dir="rtl"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    شماره همراه <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="tel"
                    value={staffForm.phone}
                    onChange={(e) => setStaffForm((prev) => ({ ...prev, phone: e.target.value }))}
                    placeholder="۰۹۱۲۳۴۵۶۷۸۹"
                    disabled={isSubmittingStaff}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 text-left font-mono"
                    dir="ltr"
                  />
                </div>
              </div>

              {/* Region (Only if role === 'visitor') */}
              {staffForm.role === 'visitor' && (
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    منطقه تحت پوشش <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={staffForm.region}
                    onChange={(e) => setStaffForm((prev) => ({ ...prev, region: e.target.value }))}
                    placeholder="مثال: منطقه ۱ (شمال شهر / بازار)"
                    disabled={isSubmittingStaff}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                    dir="rtl"
                  />
                </div>
              )}

              {/* Username & Password */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    نام کاربری ورود <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <AtSign className="w-3.5 h-3.5 absolute right-3 top-2.5 text-slate-500 pointer-events-none" />
                    <input
                      type="text"
                      value={staffForm.username}
                      onChange={(e) =>
                        setStaffForm((prev) => ({ ...prev, username: e.target.value.trim() }))
                      }
                      placeholder="visitor4 یا warehouse2"
                      disabled={isSubmittingStaff}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pr-9 pl-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 text-left font-mono"
                      dir="ltr"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    رمز عبور <span className="text-rose-400">*</span> (حداقل ۶ کاراکتر)
                  </label>
                  <div className="relative">
                    <KeyRound className="w-3.5 h-3.5 absolute right-3 top-2.5 text-slate-500 pointer-events-none" />
                    <input
                      type="password"
                      value={staffForm.password}
                      onChange={(e) => setStaffForm((prev) => ({ ...prev, password: e.target.value }))}
                      placeholder="••••••"
                      disabled={isSubmittingStaff}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pr-9 pl-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 text-left font-mono"
                      dir="ltr"
                    />
                  </div>
                </div>
              </div>

              {/* Footer Buttons */}
              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddStaffOpen(false);
                    setStaffError(null);
                    setStaffSuccess(null);
                  }}
                  disabled={isSubmittingStaff}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition cursor-pointer disabled:opacity-50"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingStaff}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-95 text-white text-xs font-bold transition shadow-md shadow-blue-600/30 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmittingStaff ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>در حال ثبت حساب...</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4" />
                      <span>ثبت و ساخت حساب</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
