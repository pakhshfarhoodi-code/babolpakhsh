import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { UserRole } from '../types';
import {
  ShieldCheck,
  Truck,
  Store,
  Warehouse,
  ThermometerSnowflake,
  User,
  LogOut,
  MapPin,
  Phone,
  Sun,
  Moon,
} from 'lucide-react';
import { StoreProfileSheet } from './shop/StoreProfileSheet';

interface HeaderProps {
  currentPath?: string;
  onNavigate?: (path: string) => void;
}

export const Header: React.FC<HeaderProps> = ({ currentPath, onNavigate }) => {
  const {
    role,
    setRole,
    selectedVisitorId,
    visitors,
    reassignmentRequests,
    loadingBills,
    currentUser,
    logout,
    supermarkets,
    selectedSupermarketId,
    theme,
    toggleTheme,
  } = useApp();

  const [isStoreProfileOpen, setIsStoreProfileOpen] = useState(false);

  const currentStore = supermarkets.find((s) => s.id === selectedSupermarketId) || supermarkets[0];
  const assignedVisitor = visitors.find((v) => v.id === currentStore?.assigned_visitor_id) || visitors[0];
  const currentVisitor = visitors.find((v) => v.id === selectedVisitorId) || visitors[0];

  const handleRoleClick = (newRole: UserRole) => {
    setRole(newRole);
    if (onNavigate) {
      if (newRole === 'supermarket') onNavigate('/');
      else if (newRole === 'visitor') onNavigate('/visitor');
      else if (newRole === 'admin' || newRole === 'warehouse') onNavigate('/admin');
    }
  };

  const pendingReassignments = reassignmentRequests.filter((r) => r.status === 'pending').length;
  const pendingLoadingBills = loadingBills.filter((b) => b.status === 'pending').length;

  // 1. Slim single-line header for Supermarket role
  if (role === 'supermarket') {
    return (
      <>
        <header className="border-b border-slate-800 bg-slate-900/95 sticky top-0 z-40 backdrop-blur-md shadow-sm">
          <div className="max-w-7xl mx-auto px-3 sm:px-5 py-2">
            <div className="flex items-center justify-between gap-2">
              {/* Right: Store Name & Profile Sheet Trigger */}
              <button
                type="button"
                onClick={() => setIsStoreProfileOpen(true)}
                className="flex items-center gap-2 min-w-0 hover:opacity-85 transition cursor-pointer text-right group"
                title="مشاهده پروفایل فروشگاه و ویزیتور"
              >
                <div className="w-8 h-8 rounded-lg bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                  <Store className="w-4 h-4" />
                </div>
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-sm font-bold text-slate-100 truncate max-w-[170px] sm:max-w-[280px]">
                    {currentStore.name}
                  </span>
                  <span className="text-xs text-emerald-400 bg-emerald-950/80 px-1.5 py-0.5 rounded border border-emerald-800/40 shrink-0">
                    پروفایل
                  </span>
                </div>
              </button>

              {/* Left: Call Visitor + Theme Toggle + Logout */}
              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                {assignedVisitor?.phone && (
                  <a
                    href={`tel:${assignedVisitor.phone}`}
                    title={`تماس تلفنی با ویزیتور (${assignedVisitor.name})`}
                    className="p-2 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/40 transition cursor-pointer shrink-0"
                  >
                    <Phone className="w-4 h-4" />
                  </a>
                )}

                <button
                  id="theme-toggle-btn"
                  onClick={toggleTheme}
                  title={theme === 'dark' ? 'تغییر به حالت روز (روشن)' : 'تغییر به حالت شب (تاریک)'}
                  className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60 transition cursor-pointer shrink-0"
                >
                  {theme === 'dark' ? (
                    <Sun className="w-4 h-4 text-amber-400" />
                  ) : (
                    <Moon className="w-4 h-4 text-indigo-400" />
                  )}
                </button>

                <button
                  id="header-logout-btn"
                  onClick={() => logout()}
                  title="خروج از حساب کاربری و بازگشت به صفحه ورود"
                  className="p-2 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 hover:text-rose-200 border border-rose-500/40 transition cursor-pointer shrink-0"
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
      </>
    );
  }

  // 2. Slim single-line header for Visitor role
  if (role === 'visitor') {
    return (
      <header className="border-b border-slate-800 bg-slate-900/95 sticky top-0 z-40 backdrop-blur-md shadow-sm">
        <div className="max-w-7xl mx-auto px-3 sm:px-5 py-2">
          <div className="flex items-center justify-between gap-2">
            {/* Right: Visitor Name & Region Badge */}
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
                <Truck className="w-4 h-4" />
              </div>
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-sm font-bold text-slate-100 truncate max-w-[150px] sm:max-w-[240px]">
                  {currentVisitor.name}
                </span>
                <span className="text-[11px] font-semibold text-blue-300 bg-blue-950/80 px-2 py-0.5 rounded-md border border-blue-800/50 shrink-0">
                  {currentVisitor.region}
                </span>
              </div>
            </div>

            {/* Left: Theme Toggle + Logout */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <button
                id="theme-toggle-btn"
                onClick={toggleTheme}
                title={theme === 'dark' ? 'تغییر به حالت روز (روشن)' : 'تغییر به حالت شب (تاریک)'}
                className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60 transition cursor-pointer shrink-0"
              >
                {theme === 'dark' ? (
                  <Sun className="w-4 h-4 text-amber-400" />
                ) : (
                  <Moon className="w-4 h-4 text-indigo-400" />
                )}
              </button>

              <button
                id="header-logout-btn"
                onClick={() => logout()}
                title="خروج از حساب کاربری و بازگشت به صفحه ورود"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 hover:text-rose-200 border border-rose-500/40 transition text-xs font-semibold cursor-pointer shrink-0"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">خروج</span>
              </button>
            </div>
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="border-b border-slate-800 bg-slate-900/95 sticky top-0 z-40 backdrop-blur-md shadow-sm">
      <div className="max-w-7xl mx-auto px-3 sm:px-5 py-1.5">
        <div className="flex items-center justify-between gap-x-2 sm:gap-x-4 gap-y-1.5 flex-wrap lg:flex-nowrap">
          
          {/* 1. Right Section (RTL): Brand & Portal Badge */}
          <div className="flex items-center gap-2 shrink-0 order-1">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center text-white shadow-sm shrink-0">
              <ThermometerSnowflake className="w-4 h-4 text-white" />
            </div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-xs sm:text-sm font-bold text-slate-100 whitespace-nowrap">سامانه پخش البرز</h1>
              {role === 'supermarket' ? (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800/60 whitespace-nowrap">
                  سفارش آنلاین
                </span>
              ) : role === 'visitor' ? (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-950 text-blue-400 border border-blue-800/60 whitespace-nowrap">
                  پورتال ویزیتور
                </span>
              ) : (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-indigo-950 text-indigo-400 border border-indigo-800/60 whitespace-nowrap">
                  مدیریت و انبار
                </span>
              )}
            </div>
          </div>

          {/* 2. Left Section (RTL): User info + Theme Toggle + Logout (Order 2 on mobile, Order 3 on desktop) */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 order-2 lg:order-3 justify-end">
            {/* User Identity badge for Visitor */}
            {role === 'visitor' ? (
              <div
                id="header-visitor-badge"
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-950/70 border border-blue-800/60 text-slate-200 shadow-sm"
              >
                <div className="w-5 h-5 rounded bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400 shrink-0">
                  <User className="w-3 h-3" />
                </div>
                <div className="flex items-center gap-1.5 text-right">
                  <span className="text-xs font-bold text-slate-100 max-w-[90px] sm:max-w-none truncate">
                    {currentVisitor?.name || currentUser.name}
                  </span>
                  <span className="text-[10px] font-mono font-medium text-blue-300 bg-blue-900/70 px-1.5 py-0.2 rounded border border-blue-700/50 dir-ltr whitespace-nowrap">
                    {currentVisitor?.username || currentUser.username || 'visitor1'}
                  </span>
                </div>
              </div>
            ) : (role === 'admin' || role === 'warehouse') ? (
              <div
                id="header-user-badge"
                className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-800/90 border border-slate-700/70 text-slate-200 shadow-sm"
              >
                <div className="w-5 h-5 rounded bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400 shrink-0">
                  <User className="w-3 h-3" />
                </div>
                <div className="flex items-center gap-1 text-right">
                  <span className="text-xs font-bold text-slate-100 max-w-[80px] sm:max-w-none truncate">{currentUser.name}</span>
                  <span className="text-[10px] font-medium px-1.5 py-0.2 rounded bg-blue-950/80 text-blue-400 border border-blue-800/50 hidden md:inline-block">
                    {currentUser.roleTitle}
                  </span>
                </div>
              </div>
            ) : null}

            {/* Day / Night Theme Toggle */}
            <button
              id="theme-toggle-btn"
              onClick={toggleTheme}
              title={theme === 'dark' ? 'تغییر به حالت روز (روشن)' : 'تغییر به حالت شب (تاریک)'}
              className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60 transition cursor-pointer shrink-0 shadow-sm"
            >
              {theme === 'dark' ? (
                <Sun className="w-3.5 h-3.5 text-amber-400" />
              ) : (
                <Moon className="w-3.5 h-3.5 text-indigo-500" />
              )}
            </button>

            {/* Logout button */}
            <button
              id="header-logout-btn"
              onClick={() => logout()}
              title="خروج از حساب کاربری و بازگشت به صفحه ورود"
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 active:scale-95 text-rose-300 hover:text-rose-200 border border-rose-500/40 transition text-xs font-semibold cursor-pointer shadow-sm shrink-0"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>خروج</span>
            </button>
          </div>

          {/* 3. Center Section: Compact context details (Order 3 on mobile -> takes w-full, Order 2 on desktop -> takes flex-1) */}
          <div className="w-full lg:w-auto lg:flex-1 order-3 lg:order-2 flex items-center justify-center min-w-0">
            {role === 'supermarket' ? (
              <div className="w-full lg:w-auto flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-1.5 sm:gap-2 min-w-0">
                {/* Store identity: Title & owner on line 1, address directly under on line 2 */}
                <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-800/90 border border-slate-700/80 text-slate-100 shadow-sm min-w-0 flex-1 sm:flex-initial">
                  <div className="w-6 h-6 rounded-md bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                    <Store className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex flex-col text-right justify-center min-w-0 flex-1">
                    {/* Line 1: Title and Owner */}
                    <div className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap">
                      <span className="font-bold text-slate-100 text-xs truncate">{currentStore.name}</span>
                      <span className="text-[10px] text-emerald-300 bg-emerald-950/80 px-1.5 py-0.2 rounded border border-emerald-800/40 whitespace-nowrap">
                        مدیریت: {currentStore.owner}
                      </span>
                    </div>
                    {/* Line 2: Address directly underneath */}
                    {currentStore.address && (
                      <div className="flex items-center gap-1 text-[11px] text-slate-400 mt-0.5 min-w-0" title={currentStore.address}>
                        <MapPin className="w-2.5 h-2.5 text-emerald-400 shrink-0" />
                        <span className="truncate max-w-[280px] sm:max-w-[240px] xl:max-w-[360px]">{currentStore.address}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Assigned Visitor Pill: in width alongside the supermarket box */}
                {assignedVisitor && (
                  <div className="flex items-center justify-between sm:justify-start gap-2 px-2.5 py-1.5 rounded-lg bg-blue-950/40 border border-blue-800/50 text-slate-200 shadow-sm min-w-0 flex-1 sm:flex-initial">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <div className="w-6 h-6 rounded-md bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
                        <Truck className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex items-center gap-1 text-xs truncate">
                        <span className="text-slate-400 text-[11px] whitespace-nowrap">ویزیتور:</span>
                        <span className="font-bold text-slate-100 text-xs truncate">{assignedVisitor.name}</span>
                      </div>
                    </div>
                    <a
                      href={`tel:${assignedVisitor.phone}`}
                      title="تماس با ویزیتور"
                      className="flex items-center gap-1 text-[11px] text-blue-300 hover:text-white bg-blue-900/60 hover:bg-blue-800/80 px-1.5 py-0.5 rounded border border-blue-700/40 transition font-mono dir-ltr shrink-0"
                    >
                      <Phone className="w-2.5 h-2.5 text-blue-400" />
                      <span>{assignedVisitor.phone}</span>
                    </a>
                  </div>
                )}
              </div>
            ) : role === 'visitor' ? null : (
              /* Admin & Warehouse Navigation Tabs */
              <div className="grid grid-cols-2 lg:flex items-center gap-1 bg-slate-950/80 p-0.5 rounded-lg border border-slate-800 shadow-inner w-full lg:w-auto">
                <button
                  id="role-btn-admin"
                  onClick={() => handleRoleClick('admin')}
                  className={`flex items-center justify-center gap-1.5 px-3 py-1.5 lg:py-1 rounded-md text-xs font-semibold transition cursor-pointer ${
                    role === 'admin'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                  <span className="whitespace-nowrap">مدیریت مرکزی</span>
                  {pendingReassignments > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-500 text-slate-950 shrink-0">
                      {pendingReassignments}
                    </span>
                  )}
                </button>

                <button
                  id="role-btn-warehouse"
                  onClick={() => handleRoleClick('warehouse')}
                  className={`flex items-center justify-center gap-1.5 px-3 py-1.5 lg:py-1 rounded-md text-xs font-semibold transition cursor-pointer ${
                    role === 'warehouse'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  <Warehouse className="w-3.5 h-3.5 shrink-0" />
                  <span className="whitespace-nowrap">انبار و سردخانه</span>
                  {pendingLoadingBills > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-500 text-slate-950 shrink-0">
                      {pendingLoadingBills}
                    </span>
                  )}
                </button>
              </div>
            )}
          </div>

        </div>
      </div>
    </header>
  );
};
