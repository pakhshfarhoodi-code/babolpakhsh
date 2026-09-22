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

export const Header: React.FC = () => {
  const {
    role,
    setRole,
    selectedVisitorId,
    setSelectedVisitorId,
    selectedSupermarketId,
    setSelectedSupermarketId,
    visitors,
    supermarkets,
    reassignmentRequests,
    loadingBills,
    resetToDefaults,
    currentUser,
    logout,
  } = useApp();

  const pendingReassignments = reassignmentRequests.filter((r) => r.status === 'pending').length;
  const pendingLoadingBills = loadingBills.filter((b) => b.status === 'pending').length;

  const rolesConfig: { role: UserRole; title: string; icon: React.ReactNode; badge?: number }[] = [
    {
      role: 'admin',
      title: 'مدیریت مرکزی',
      icon: <ShieldCheck className="w-4 h-4" />,
      badge: pendingReassignments > 0 ? pendingReassignments : undefined,
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
    {
      role: 'warehouse',
      title: 'انبار و سردخانه',
      icon: <Warehouse className="w-4 h-4" />,
      badge: pendingLoadingBills > 0 ? pendingLoadingBills : undefined,
    },
  ];

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
                  onClick={() => setRole(item.role)}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all ${
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

          {/* Persona selector depending on role */}
          <div className="flex items-center gap-2">
            {role === 'visitor' && (
              <div className="flex items-center gap-2 bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700 text-xs">
                <User className="w-3.5 h-3.5 text-blue-400" />
                <span className="text-slate-400">ویزیتور فعال:</span>
                <select
                  id="visitor-selector"
                  value={selectedVisitorId}
                  onChange={(e) => setSelectedVisitorId(e.target.value)}
                  className="bg-slate-900 text-slate-200 font-semibold rounded px-2 py-0.5 border border-slate-700 focus:outline-none focus:border-blue-500"
                >
                  {visitors.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} ({v.region})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {role === 'supermarket' && (
              <div className="flex items-center gap-2 bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700 text-xs">
                <Store className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-slate-400">فروشگاه فعال:</span>
                <select
                  id="supermarket-selector"
                  value={selectedSupermarketId}
                  onChange={(e) => setSelectedSupermarketId(e.target.value)}
                  className="bg-slate-900 text-slate-200 font-semibold rounded px-2 py-0.5 border border-slate-700 focus:outline-none focus:border-emerald-500"
                >
                  {supermarkets.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} - {s.owner}
                    </option>
                  ))}
                </select>
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
