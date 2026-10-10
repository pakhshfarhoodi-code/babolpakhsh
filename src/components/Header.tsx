import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  ThermometerSnowflake,
  ShieldCheck,
  Warehouse,
  Truck,
  User,
  LogOut,
  Moon,
  Sun,
  Store,
  Phone,
} from 'lucide-react';
import { StoreProfileSheet } from './shop/StoreProfileSheet';
import { VisitorProfileSheet } from './visitor/VisitorProfileSheet';
import { AdminProfileModal } from './AdminProfileModal';
import appLogo from '../assets/images/farhoodi_b2b_logo.webp';

interface HeaderProps {
  currentPath?: string;
  onNavigate?: (path: string) => void;
}

export const Header: React.FC<HeaderProps> = () => {
  const {
    role,
    setRole,
    currentUser,
    selectedSupermarketId,
    selectedVisitorId,
    supermarkets,
    visitors,
    orders,
    loadingBills,
    theme,
    toggleTheme,
    logout,
    adminProfile,
    invoiceSettings,
  } = useApp();

  const currentLogo = invoiceSettings?.logo_url || appLogo;

  const defaultStore = useMemo(() => ({
    id: 'sm-default',
    name: 'فروشگاه طرف قرارداد',
    owner: 'متصدی فروشگاه',
    phone: '۰۹۱۱۰۰۰۰۰۰۰',
    address: 'ثبت شده در سامانه مرکزی پخش',
    assigned_visitor_id: '',
    credit_limit: 50000000,
    current_debt: 0,
    is_active: true,
  }), []);

  const defaultVisitor = useMemo(() => ({
    id: '',
    name: 'واحد ویزیت و توزیع',
    phone: '',
    region: 'عمومی',
    username: 'visitor',
    is_active: true,
  }), []);

  const currentStore =
    supermarkets.find((s) => s.id === selectedSupermarketId || (currentUser.id && s.id === currentUser.id)) ||
    (currentUser.id
      ? { ...defaultStore, id: currentUser.id, name: currentUser.name, phone: currentUser.phone }
      : defaultStore);

  const assignedVisitor = visitors.find((v) => v.id === currentStore?.assigned_visitor_id);
  const currentVisitor =
    visitors.find((v) => v.id === selectedVisitorId || (currentUser.id && v.id === currentUser.id)) ||
    (currentUser.id
      ? { ...defaultVisitor, id: currentUser.id, name: currentUser.name, phone: currentUser.phone }
      : defaultVisitor);

  const [isStoreProfileOpen, setIsStoreProfileOpen] = useState(false);
  const [isVisitorProfileOpen, setIsVisitorProfileOpen] = useState(false);
  const [isAdminProfileOpen, setIsAdminProfileOpen] = useState(false);

  // Counter metrics
  const pendingReassignments = orders.filter((o) => o.status === 'delegated').length;
  const pendingLoadingBills = loadingBills.filter((b) => b.status === 'pending').length;
  const awaitingExitBills = loadingBills.filter((b) => b.status === 'approved').length;

  // 1. Supermarket Portal Header
  if (role === 'supermarket') {
    return (
      <>
        <header className="border-b border-slate-800/80 bg-slate-900/90 sticky top-0 z-40 backdrop-blur-xl shadow-lg shadow-black/20">
          <div className="max-w-7xl mx-auto px-3 sm:px-5 py-2">
            <div className="flex items-center justify-between gap-2.5 min-w-0">
              {/* Right Side: Logo Badge + "بارفروش | پخش فرهودی" Button to view Admin Profile */}
              <div className="flex items-center gap-2 shrink-0">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-amber-500 p-0.5 shadow-md shadow-blue-500/20 shrink-0 overflow-hidden flex items-center justify-center bg-slate-900">
                  <img src={currentLogo} alt="لوگوی پخش فرهودی" className="w-full h-full object-contain rounded-[10px]" />
                </div>
                <button
                  type="button"
                  onClick={() => setIsAdminProfileOpen(true)}
                  className="px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500/15 to-blue-500/15 hover:from-amber-500/25 hover:to-blue-500/25 text-amber-300 hover:text-amber-200 border border-amber-500/30 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs select-none"
                  title="مشاهده اطلاعات و مشخصات مدیریت پخش فرهودی"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                  <span className="hidden xs:inline">{adminProfile.business_title || 'بارفروش | پخش فرهودی'}</span>
                  <span className="xs:hidden">{adminProfile.business_title || 'پخش فرهودی'}</span>
                </button>
              </div>

              {/* Center: Store Emoji & Name (Clickable to open Store Profile Sheet) */}
              <button
                type="button"
                onClick={() => setIsStoreProfileOpen(true)}
                className="flex items-center gap-2 min-w-0 hover:opacity-85 transition cursor-pointer text-right group p-1 sm:p-1.5 rounded-xl hover:bg-slate-800/50"
                title="مشاهده و ویرایش مشخصات فروشگاه"
              >
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-600/30 to-teal-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0 shadow-inner text-base">
                  🏪
                </div>
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-sm font-bold text-slate-100 truncate max-w-[140px] sm:max-w-[220px] group-hover:text-emerald-300 transition">
                    {currentStore?.name || 'فروشگاه طرف قرارداد'}
                  </span>
                </div>
              </button>

              {/* Left Side: Call Visitor + Theme + Logout */}
              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                {assignedVisitor?.phone && (
                  <a
                    href={`tel:${assignedVisitor.phone}`}
                    title={`تماس تلفنی با ویزیتور (${assignedVisitor.name})`}
                    className="p-2 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 transition cursor-pointer shrink-0"
                  >
                    <Phone className="w-4 h-4" />
                  </a>
                )}

                <button
                  id="theme-toggle-btn"
                  onClick={toggleTheme}
                  title={theme === 'dark' ? 'تغییر به حالت روز (روشن)' : 'تغییر به حالت شب (تاریک)'}
                  className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 hover:text-white border border-slate-700/60 transition cursor-pointer shrink-0"
                >
                  {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-400" />}
                </button>

                <button
                  id="header-logout-btn"
                  onClick={() => logout()}
                  title="خروج از حساب کاربری و بازگشت به صفحه ورود"
                  className="p-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 hover:text-rose-200 border border-rose-500/40 transition cursor-pointer shrink-0"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </header>

        <StoreProfileSheet
          isOpen={isStoreProfileOpen}
          onClose={() => setIsStoreProfileOpen(false)}
          store={currentStore}
          visitor={assignedVisitor}
        />

        <AdminProfileModal
          isOpen={isAdminProfileOpen}
          onClose={() => setIsAdminProfileOpen(false)}
        />
      </>
    );
  }

  // 2. Visitor Portal Header
  if (role === 'visitor') {
    return (
      <>
        <header className="border-b border-slate-800/80 bg-slate-900/90 sticky top-0 z-40 backdrop-blur-xl shadow-lg shadow-black/20">
          <div className="max-w-7xl mx-auto px-3 sm:px-5 py-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-amber-500 p-0.5 shadow-md shadow-blue-500/20 shrink-0 overflow-hidden flex items-center justify-center bg-slate-900">
                  <img src={currentLogo} alt="لوگوی پخش فرهودی" className="w-full h-full object-contain rounded-[10px]" />
                </div>

                <button
                  type="button"
                  onClick={() => setIsVisitorProfileOpen(true)}
                  className="flex items-center gap-2 min-w-0 hover:opacity-85 transition cursor-pointer text-right group"
                  title="مشاهده پروفایل ویزیتور و تغییر رمز عبور"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm font-bold text-slate-100 truncate max-w-[130px] sm:max-w-[200px]">
                      {currentVisitor?.name || 'واحد ویزیت و توزیع'}
                    </span>
                    <span className="text-xs font-semibold text-blue-300 bg-blue-950/80 px-2 py-0.5 rounded-full border border-blue-800/50 shrink-0">
                      {currentVisitor?.region || 'عمومی'}
                    </span>
                    <span className="text-xs text-blue-400 bg-blue-950/80 px-2 py-0.5 rounded-full border border-blue-800/40 shrink-0">
                      پروفایل
                    </span>
                  </div>
                </button>
              </div>

              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                <button
                  id="theme-toggle-btn"
                  onClick={toggleTheme}
                  title={theme === 'dark' ? 'تغییر به حالت روز (روشن)' : 'تغییر به حالت شب (تاریک)'}
                  className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 hover:text-white border border-slate-700/60 transition cursor-pointer shrink-0"
                >
                  {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-400" />}
                </button>

                <button
                  id="header-logout-btn"
                  onClick={() => logout()}
                  title="خروج از حساب کاربری و بازگشت به صفحه ورود"
                  className="p-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 hover:text-rose-200 border border-rose-500/40 transition text-xs font-semibold cursor-pointer shrink-0"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </header>

        <VisitorProfileSheet
          isOpen={isVisitorProfileOpen}
          onClose={() => setIsVisitorProfileOpen(false)}
          visitor={currentVisitor}
        />
      </>
    );
  }

  // 3. Exactly identical slim single-line layout for Admin and Warehouse
  return (
    <>
      <header className="border-b border-slate-800/80 bg-slate-900/90 sticky top-0 z-40 backdrop-blur-xl shadow-lg shadow-black/20">
      <div className="max-w-7xl mx-auto px-3 sm:px-5 py-2">
        <div className="flex items-center justify-between gap-2">
          
          {/* Right Section: Identity Icon + Name + Role Switcher Pill */}
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-amber-500 p-0.5 shadow-md shadow-blue-500/20 shrink-0 overflow-hidden flex items-center justify-center bg-slate-900">
              <img src={currentLogo} alt="لوگوی پخش فرهودی" className="w-full h-full object-contain rounded-[10px]" />
            </div>

            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-sm font-bold text-slate-100 truncate max-w-[130px] sm:max-w-[180px]">
                {currentUser.name}
              </span>
              <button
                type="button"
                onClick={() => setIsAdminProfileOpen(true)}
                className="text-[11px] text-amber-400/90 bg-amber-950/40 hover:bg-amber-900/60 hover:text-amber-300 px-2.5 py-0.5 rounded-full border border-amber-800/40 shrink-0 hidden md:inline-block font-medium cursor-pointer transition select-none"
                title="ویرایش و مشاهده مشخصات مدیریت و مرکز پخش"
              >
                {adminProfile.business_title || 'بارفروش | پخش فرهودی'}
              </button>

              {/* Role Toggle Pill right beside user name */}
              <div className="flex items-center p-0.5 rounded-lg bg-slate-950 border border-slate-800 shrink-0">
                <button
                  id="role-btn-admin"
                  type="button"
                  onClick={() => setRole('admin')}
                  className={`px-2 py-0.5 rounded-md text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                    role === 'admin'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <ShieldCheck className="w-3 h-3" />
                  <span>مدیریت</span>
                  {pendingLoadingBills > 0 && (
                    <span
                      className="px-1.5 py-0.5 rounded-full text-xs font-black bg-amber-400 text-slate-950 font-mono"
                      title={`${pendingLoadingBills} برگه بارگیری در انتظار تایید`}
                    >
                      {pendingLoadingBills}
                    </span>
                  )}
                  {pendingReassignments > 0 && (
                    <span
                      className="px-1.5 py-0.5 rounded-full text-xs font-black bg-purple-400 text-slate-950 font-mono"
                      title={`${pendingReassignments} واگذاری در انتظار`}
                    >
                      {pendingReassignments}
                    </span>
                  )}
                </button>

                <button
                  id="role-btn-warehouse"
                  type="button"
                  onClick={() => setRole('warehouse')}
                  className={`px-2 py-0.5 rounded-md text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                    role === 'warehouse'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Warehouse className="w-3 h-3" />
                  <span>انبار</span>
                  {pendingLoadingBills > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full text-xs font-black bg-amber-400 text-slate-950">
                      {pendingLoadingBills}
                    </span>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Left Section: Theme Toggle + Logout (Exact match with supermarket header) */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              id="theme-toggle-btn"
              onClick={toggleTheme}
              title={theme === 'dark' ? 'تغییر به حالت روز (روشن)' : 'تغییر به حالت شب (تاریک)'}
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 hover:text-white border border-slate-700/60 transition cursor-pointer shrink-0"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-400" />}
            </button>

            <button
              id="header-logout-btn"
              onClick={() => logout()}
              title="خروج از حساب کاربری و بازگشت به صفحه ورود"
              className="p-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 hover:text-rose-200 border border-rose-500/40 transition cursor-pointer shrink-0"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>

        </div>
      </div>
    </header>

    <AdminProfileModal
      isOpen={isAdminProfileOpen}
      onClose={() => setIsAdminProfileOpen(false)}
    />
  </>
);
};
