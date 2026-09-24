import React from 'react';
import { useApp } from '../context/AppContext';
import { UserRole } from '../types';
import {
  ShieldCheck,
  Truck,
  Store,
  Warehouse,
  ThermometerSnowflake,
  RotateCcw,
  User,
  CheckCircle2,
  LogOut,
} from 'lucide-react';

interface HeaderProps {
  currentPath?: string;
  onNavigate?: (path: string) => void;
}

export const Header: React.FC<HeaderProps> = ({ currentPath, onNavigate }) => {
  const {
    role,
    setRole,
    selectedVisitorId,
    setSelectedVisitorId,
    visitors,
    reassignmentRequests,
    loadingBills,
    resetToDefaults,
    currentUser,
    logout,
  } = useApp();

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

  const allRolesConfig: { role: UserRole; title: string; icon: React.ReactNode; badge?: number }[] = [
    {
      role: 'admin',
      title: 'مدیریت مرکزی',
      icon: <ShieldCheck className="w-4 h-4" />,
      badge: pendingReassignments > 0 ? pendingReassignments : undefined,
    },
    {
      role: 'warehouse',
      title: 'انبار و سردخانه',
      icon: <Warehouse className="w-4 h-4" />,
      badge: pendingLoadingBills > 0 ? pendingLoadingBills : undefined,
    },
    {
      role: 'visitor',
      title: 'پورتال ویزیتور',
      icon: <Truck className="w-4 h-4" />,
      badge: pendingReassignments > 0 ? pendingReassignments : undefined,
    },
    {
      role: 'supermarket',
      title: 'سفارش سوپرمارکت',
      icon: <Store className="w-4 h-4" />,
    },
  ];

  // Filter tabs according to current section/route
  const rolesConfig = allRolesConfig.filter((item) => {
    if (currentPath === '/admin') {
      return item.role === 'admin' || item.role === 'warehouse';
    }
    if (currentPath === '/visitor') {
      return item.role === 'visitor';
    }
    if (currentPath === '/') {
      return item.role === 'supermarket';
    }
    return true;
  });

  return (
    <header className="border-b border-slate-800 bg-slate-900/95 sticky top-0 z-40 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
        {/* Top bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
              <ThermometerSnowflake className="w-5 h-5 text-blue-100 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-slate-100 tracking-tight">سامانه پخش مویرگی البرز</h1>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-950 text-blue-400 border border-blue-800/60">
                  زنجیره سرد منجمد
                </span>
                {currentPath && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700 dir-ltr">
                    {currentPath}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">سیستم متمرکز توزیع، رزرو کالا و پورتال یکپارچه فروش</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Active User Info */}
            <div
              id="header-user-badge"
              className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-slate-800/90 border border-slate-700/70 text-slate-200 shadow-sm"
            >
              <div className="w-7 h-7 rounded-lg bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
                <User className="w-3.5 h-3.5" />
              </div>
              <div className="flex flex-col text-right">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-slate-100">{currentUser.name}</span>
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-blue-950/80 text-blue-400 border border-blue-800/50">
                    {currentUser.roleTitle}
                  </span>
                </div>
              </div>
            </div>

            {/* Logout Button */}
            <button
              id="header-logout-btn"
              onClick={() => {
                logout();
              }}
              title="خروج از حساب کاربری و بازگشت به صفحه ورود"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 active:scale-95 text-rose-300 hover:text-rose-200 border border-rose-500/40 transition text-xs font-semibold cursor-pointer shadow-sm"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>خروج</span>
            </button>

            {/* Reset to defaults */}
            <button
              onClick={() => {
                if (window.confirm('آیا از بازنشانی داده‌های نمونه اولیه اطمینان دارید؟')) {
                  resetToDefaults();
                }
              }}
              title="بازنشانی داده‌های اولیه"
              className="p-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border border-slate-700/60 transition cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Role navigation and active profile selector */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3">
          {/* Role switcher tabs */}
          <div className="flex items-center gap-1.5 bg-slate-950/70 p-1 rounded-xl border border-slate-800">
            {rolesConfig.map((item) => {
              const active = role === item.role;
              return (
                <button
                  key={item.role}
                  id={`role-btn-${item.role}`}
                  onClick={() => handleRoleClick(item.role)}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all cursor-pointer ${
                    active
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  {item.icon}
                  <span>{item.title}</span>
                  {item.badge ? (
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-500 text-slate-950">
                      {item.badge}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>

          {/* Quick Route Switcher */}
          {onNavigate && (
            <div className="hidden lg:flex items-center gap-1.5 bg-slate-950/60 px-2 py-1 rounded-xl border border-slate-800 text-[11px]">
              <span className="text-slate-500 text-[10px] ml-1">مسیرها:</span>
              <button
                type="button"
                onClick={() => onNavigate('/')}
                className={`px-2 py-0.5 rounded-lg transition font-mono ${
                  currentPath === '/'
                    ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                / فروشگاه
              </button>
              <button
                type="button"
                onClick={() => onNavigate('/visitor')}
                className={`px-2 py-0.5 rounded-lg transition font-mono ${
                  currentPath === '/visitor'
                    ? 'bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                /visitor ویزیتور
              </button>
              <button
                type="button"
                onClick={() => onNavigate('/admin')}
                className={`px-2 py-0.5 rounded-lg transition font-mono ${
                  currentPath === '/admin'
                    ? 'bg-blue-500/20 text-blue-300 font-bold border border-blue-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                /admin مدیریت و انبار
              </button>
            </div>
          )}

          {/* Persona selector depending on role */}
          <div className="flex items-center gap-2">
            {role === 'visitor' && (
              <div className="flex items-center gap-2 bg-blue-950/60 border border-blue-800/50 px-3 py-1.5 rounded-lg text-xs text-blue-300">
                <Truck className="w-3.5 h-3.5 text-blue-400" />
                <span className="font-semibold">{currentUser.name}</span>
                <span className="text-[10px] text-blue-400/80 bg-blue-900/60 px-1.5 py-0.5 rounded border border-blue-700/40">
                  {visitors.find((v) => v.id === selectedVisitorId)?.region || 'ویزیتور البرز'}
                </span>
              </div>
            )}

            {role === 'supermarket' && (
              <div className="flex items-center gap-2 bg-emerald-950/60 border border-emerald-800/50 px-3 py-1.5 rounded-lg text-xs text-emerald-300">
                <Store className="w-3.5 h-3.5 text-emerald-400" />
                <span className="font-semibold">{currentUser.name}</span>
                <span className="text-[10px] text-emerald-400/80 bg-emerald-900/60 px-1.5 py-0.5 rounded border border-emerald-700/40">
                  پنل سفارش آنلاین
                </span>
              </div>
            )}

            {role === 'admin' && (
              <div className="hidden sm:flex items-center gap-1.5 text-xs text-blue-400 bg-blue-950/60 border border-blue-800/50 px-3 py-1.5 rounded-lg">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>دسترسی مدیر ارشد (نظارت کلی و قیمت‌گذاری)</span>
              </div>
            )}

            {role === 'warehouse' && (
              <div className="hidden sm:flex items-center gap-1.5 text-xs text-indigo-400 bg-indigo-950/60 border border-indigo-800/50 px-3 py-1.5 rounded-lg">
                <Warehouse className="w-3.5 h-3.5" />
                <span>پایانه انبارداری و تحویل حواله بارگیری</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
