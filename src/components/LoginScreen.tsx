import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  ShieldCheck,
  Truck,
  Store,
  Warehouse,
  ThermometerSnowflake,
  LogIn,
  KeyRound,
  User,
  UserPlus,
  ArrowLeft,
  AlertCircle,
  Sun,
  Moon,
} from 'lucide-react';
import { UserRole } from '../types';
import { SupermarketRegisterModal } from './SupermarketRegisterModal';

interface LoginScreenProps {
  initialRole?: UserRole;
  allowedRoles?: UserRole[];
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ initialRole, allowedRoles }) => {
  const { loginWithCredentials, theme, toggleTheme } = useApp();
  const [activeTab, setActiveTab] = useState<UserRole>(() => {
    if (initialRole) return initialRole;
    if (allowedRoles && allowedRoles.length > 0) return allowedRoles[0];
    return 'supermarket';
  });

  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);

  // Sync activeTab if initialRole changes
  useEffect(() => {
    if (initialRole) {
      setActiveTab(initialRole);
    }
  }, [initialRole]);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!usernameInput.trim()) {
      setErrorMessage('لطفاً نام کاربری، ایمیل یا شماره همراه خود را وارد کنید.');
      return;
    }
    if (!passwordInput.trim()) {
      setErrorMessage('لطفاً رمز عبور خود را وارد کنید.');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await loginWithCredentials(
        usernameInput,
        passwordInput,
        allowedRoles && allowedRoles.length > 0 ? allowedRoles : [activeTab]
      );

      if (!result.success) {
        setErrorMessage(result.message || 'نام کاربری یا رمز عبور نامعتبر است.');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'خطا در برقراری ارتباط با سامانه.';
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getRoleTheme = (role: UserRole) => {
    switch (role) {
      case 'admin':
        return {
          headerTitle: 'ورود به بخش ادمین و یا انبار',
          tabLabel: 'مدیر ارشد',
          color: 'blue',
          icon: <ShieldCheck className="w-5 h-5 text-blue-400" />,
        };
      case 'warehouse':
        return {
          headerTitle: 'ورود به بخش ادمین و یا انبار',
          tabLabel: 'انبار و سردخانه',
          color: 'indigo',
          icon: <Warehouse className="w-5 h-5 text-indigo-400" />,
        };
      case 'visitor':
        return {
          headerTitle: 'ورود به بخش ویزیتورها',
          tabLabel: 'ویزیتورها',
          color: 'emerald',
          icon: <Truck className="w-5 h-5 text-emerald-400" />,
        };
      case 'supermarket':
        return {
          headerTitle: 'ورود به بخش فروشگاه‌ها',
          tabLabel: 'فروشگاه‌ها',
          color: 'amber',
          icon: <Store className="w-5 h-5 text-amber-400" />,
        };
    }
  };

  const currentTheme = getRoleTheme(activeTab);

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-hidden">
      {/* Theme Toggle Button (Day / Night mode) */}
      <button
        id="login-theme-toggle-btn"
        type="button"
        onClick={toggleTheme}
        title={theme === 'dark' ? 'تغییر به حالت روز (روشن)' : 'تغییر به حالت شب (تاریک)'}
        className="absolute top-4 left-4 p-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-slate-100 transition shadow-lg cursor-pointer z-20 flex items-center gap-2 text-xs font-medium backdrop-blur-sm"
      >
        {theme === 'dark' ? (
          <>
            <Sun className="w-4 h-4 text-amber-400" />
            <span className="hidden sm:inline">حالت روز</span>
          </>
        ) : (
          <>
            <Moon className="w-4 h-4 text-indigo-400" />
            <span className="hidden sm:inline">حالت شب</span>
          </>
        )}
      </button>

      {/* Background ambient lighting */}
      <div className="absolute top-1/4 -right-20 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -left-20 w-96 h-96 bg-cyan-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Login Card */}
      <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-2xl p-6 sm:p-8 backdrop-blur-xl shadow-2xl relative z-10">
        {/* App Header */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400 mb-3 shadow-lg shadow-blue-500/10">
            <ThermometerSnowflake className="w-7 h-7 text-blue-400" />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-100 tracking-tight">
            سامانه پخش مویرگی البرز
          </h1>
        </div>

        {/* Role Category Tabs (if more than 1 role allowed) */}
        {(!allowedRoles || allowedRoles.length > 1) && (
          <div className="grid grid-cols-2 gap-2 mb-6">
            {(!allowedRoles || allowedRoles.includes('admin')) && (
              <button
                type="button"
                onClick={() => {
                  setActiveTab('admin');
                  setErrorMessage('');
                }}
                className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-semibold transition cursor-pointer ${
                  activeTab === 'admin'
                    ? 'bg-blue-600/20 border-blue-500 text-blue-400 font-bold shadow-md'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                <ShieldCheck className="w-4 h-4 text-blue-400" />
                <span>مدیر ارشد</span>
              </button>
            )}

            {(!allowedRoles || allowedRoles.includes('warehouse')) && (
              <button
                type="button"
                onClick={() => {
                  setActiveTab('warehouse');
                  setErrorMessage('');
                }}
                className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-semibold transition cursor-pointer ${
                  activeTab === 'warehouse'
                    ? 'bg-indigo-600/20 border-indigo-500 text-indigo-400 font-bold shadow-md'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                <Warehouse className="w-4 h-4 text-indigo-400" />
                <span>انبار و سردخانه</span>
              </button>
            )}

            {(!allowedRoles || allowedRoles.includes('visitor')) && (
              <button
                type="button"
                onClick={() => {
                  setActiveTab('visitor');
                  setErrorMessage('');
                }}
                className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-semibold transition cursor-pointer ${
                  activeTab === 'visitor'
                    ? 'bg-emerald-600/20 border-emerald-500 text-emerald-400 font-bold shadow-md'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                <Truck className="w-4 h-4 text-emerald-400" />
                <span>ویزیتورها</span>
              </button>
            )}

            {(!allowedRoles || allowedRoles.includes('supermarket')) && (
              <button
                type="button"
                onClick={() => {
                  setActiveTab('supermarket');
                  setErrorMessage('');
                }}
                className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-semibold transition cursor-pointer ${
                  activeTab === 'supermarket'
                    ? 'bg-amber-600/20 border-amber-500 text-amber-400 font-bold shadow-md'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                <Store className="w-4 h-4 text-amber-400" />
                <span>فروشگاه‌ها</span>
              </button>
            )}
          </div>
        )}

        {/* Section Identity Header - Centered */}
        <div className="flex items-center justify-center gap-2 mb-5 pb-3 border-b border-slate-800/80 text-sm font-bold text-center text-slate-100">
          {currentTheme.icon}
          <span>{currentTheme.headerTitle}</span>
        </div>

        {/* Login Form */}
        <form onSubmit={handleLoginSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 text-right">
              نام کاربری:
            </label>
            <div className="relative">
              <input
                id="login-username-input"
                type="text"
                autoComplete="username"
                dir="ltr"
                placeholder="نام کاربری"
                value={usernameInput}
                onChange={(e) => {
                  setUsernameInput(e.target.value);
                  setErrorMessage('');
                }}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 pl-10 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition font-mono text-left"
              />
              <User className="w-4 h-4 text-slate-500 absolute left-3 top-3 pointer-events-none" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 text-right">
              رمز عبور:
            </label>
            <div className="relative">
              <input
                id="login-password-input"
                type="password"
                autoComplete="current-password"
                dir="ltr"
                placeholder="رمز عبور"
                value={passwordInput}
                onChange={(e) => {
                  setPasswordInput(e.target.value);
                  setErrorMessage('');
                }}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 pl-10 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition font-mono text-left"
              />
              <KeyRound className="w-4 h-4 text-slate-500 absolute left-3 top-3 pointer-events-none" />
            </div>
          </div>

          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          <button
            id="login-submit-btn"
            type="submit"
            disabled={isSubmitting}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-blue-600 hover:bg-blue-500 active:scale-[0.99] text-white rounded-xl text-sm font-bold transition cursor-pointer shadow-lg shadow-blue-600/25 disabled:opacity-50 mt-2"
          >
            <LogIn className="w-4 h-4" />
            <span>ورود به سامانه</span>
          </button>
        </form>

        {/* Supermarket registration card if on supermarket role (Compact & Sleek) */}
        {activeTab === 'supermarket' && (
          <div className="mt-4 pt-3.5 border-t border-slate-800/80">
            <button
              id="register-supermarket-bottom-btn"
              type="button"
              onClick={() => setIsRegisterModalOpen(true)}
              className={`w-full group relative overflow-hidden rounded-xl p-2.5 sm:p-3 transition-all duration-300 cursor-pointer text-right border ${
                theme === 'light'
                  ? 'bg-amber-50/95 hover:bg-amber-100/90 border-2 border-amber-500/70 hover:border-amber-600 shadow-sm hover:shadow-md'
                  : 'bg-gradient-to-r from-amber-500/15 via-amber-600/10 to-slate-900/80 hover:from-amber-500/25 hover:to-amber-600/20 border border-amber-500/40 hover:border-amber-400 shadow-md shadow-amber-500/5'
              }`}
            >
              {/* Subtle decorative glow in corner */}
              <div
                className={`absolute -left-6 -bottom-6 w-24 h-24 rounded-full blur-xl pointer-events-none transition-opacity ${
                  theme === 'light' ? 'bg-amber-400/20 group-hover:bg-amber-400/30' : 'bg-amber-500/20 group-hover:bg-amber-500/30'
                }`}
              />

              <div className="relative z-10 flex items-center justify-between gap-2.5">
                <div className="flex items-center gap-2.5 min-w-0">
                  {/* Compact Icon Badge */}
                  <div
                    className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm transition-transform duration-300 group-hover:scale-105 ${
                      theme === 'light'
                        ? 'bg-amber-600 text-white shadow-amber-600/25'
                        : 'bg-gradient-to-br from-amber-500/25 to-amber-600/20 border border-amber-500/40 text-amber-300 shadow-amber-500/20'
                    }`}
                  >
                    <Store className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>

                  {/* Text content */}
                  <div className="min-w-0">
                    <span
                      className={`text-xs sm:text-sm font-black tracking-tight transition-colors ${
                        theme === 'light' ? 'text-[#451a03]' : 'text-amber-300 group-hover:text-amber-200'
                      }`}
                    >
                      ثبت‌نام و عضویت فروشگاه
                    </span>
                  </div>
                </div>

                {/* Compact Action Button */}
                <div
                  className={`shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all duration-300 shadow-sm ${
                    theme === 'light'
                      ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-amber-600/20'
                      : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20'
                  }`}
                >
                  <span>ثبت‌نام</span>
                  <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
                </div>
              </div>
            </button>
          </div>
        )}
      </div>

      <div className="text-xs text-slate-500 mt-6 text-center">
        سامانه مدیریت توزیع و زنجیره سرد البرز
      </div>

      {/* Supermarket Registration Modal */}
      <SupermarketRegisterModal
        isOpen={isRegisterModalOpen}
        onClose={() => setIsRegisterModalOpen(false)}
      />
    </div>
  );
};
