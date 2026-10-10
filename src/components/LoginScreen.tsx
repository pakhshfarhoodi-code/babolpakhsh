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
  Phone,
  UserPlus,
  ArrowLeft,
  AlertCircle,
  Sun,
  Moon,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { UserRole } from '../types';
import { FOUNDER_INITIAL_CAPACITY } from '../utils/storeDiscount';
import bgHero from '../assets/images/b2b_frozen_food_showcase.webp';
import appLogo from '../assets/images/farhoodi_b2b_logo.webp';

const SupermarketRegisterModal = React.lazy(() =>
  import('./SupermarketRegisterModal').then((m) => ({ default: m.SupermarketRegisterModal }))
);

interface LoginScreenProps {
  initialRole?: UserRole;
  allowedRoles?: UserRole[];
  onLoginStart?: () => void;
  onLoginComplete?: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  initialRole,
  allowedRoles,
  onLoginStart,
  onLoginComplete,
}) => {
  const { loginWithCredentials, isLoggedIn, isDataReady, theme, toggleTheme, invoiceSettings, supermarkets } = useApp();
  const currentLogo = invoiceSettings?.logo_url || appLogo;

  // Remaining capacity for the first stores discount (starts from 90 minus registered stores)
  const totalRegisteredStores = supermarkets?.length || 0;
  const remainingFounderSpots = Math.max(0, FOUNDER_INITIAL_CAPACITY - totalRegisteredStores);
  const [activeTab, setActiveTab] = useState<UserRole>(() => {
    if (initialRole) return initialRole;
    if (allowedRoles && allowedRoles.length > 0) return allowedRoles[0];
    return 'supermarket';
  });

  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);

  // Sync activeTab if initialRole changes
  useEffect(() => {
    if (initialRole) {
      setActiveTab(initialRole);
    }
  }, [initialRole]);

  // Transition to app only after isDataReady is true
  useEffect(() => {
    if (isLoggingIn && isDataReady) {
      setIsFadingOut(true);
      const timer = setTimeout(() => {
        onLoginComplete?.();
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [isLoggingIn, isDataReady, onLoginComplete]);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!usernameInput.trim()) {
      setErrorMessage('لطفاً شماره موبایل خود را وارد کنید.');
      return;
    }
    if (!passwordInput.trim()) {
      setErrorMessage('لطفاً رمز عبور خود را وارد کنید.');
      return;
    }

    setIsSubmitting(true);
    onLoginStart?.();
    try {
      const result = await loginWithCredentials(
        usernameInput,
        passwordInput,
        [activeTab]
      );

      if (!result.success) {
        setErrorMessage(result.message || 'شماره یا رمز عبور نادرست است.');
        setIsSubmitting(false);
        onLoginComplete?.();
      } else {
        setIsLoggingIn(true);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'خطا در برقراری ارتباط با سامانه.';
      setErrorMessage(message);
      setIsSubmitting(false);
      onLoginComplete?.();
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
    <div className={`min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-hidden selection:bg-blue-500 selection:text-white transition-opacity duration-150 ${
      isFadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
    }`}>
      {/* Background Logistics & Food Distribution Hero Image */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat transition-all duration-700 scale-105"
        style={{ backgroundImage: `url(${bgHero})` }}
      />
      {/* Dark Vignette & Atmospheric Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/70 to-slate-950/60 backdrop-blur-[2px]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-950/30 via-slate-950/60 to-slate-950/90" />

      {/* Theme Toggle Button (Day / Night mode) */}
      <button
        id="login-theme-toggle-btn"
        type="button"
        onClick={toggleTheme}
        title={theme === 'dark' ? 'تغییر به حالت روز (روشن)' : 'تغییر به حالت شب (تاریک)'}
        className={`absolute top-4 left-4 p-2.5 rounded-2xl border transition shadow-xl cursor-pointer z-20 flex items-center gap-2 text-xs font-semibold backdrop-blur-md ${
          theme === 'light'
            ? 'bg-white/90 hover:bg-white border-slate-300 text-slate-900 shadow-slate-300/50'
            : 'bg-slate-900/80 hover:bg-slate-800/90 border-slate-800 text-slate-300 hover:text-slate-100'
        }`}
      >
        {theme === 'dark' ? (
          <>
            <Sun className="w-4 h-4 text-amber-400" />
            <span className="hidden sm:inline">حالت روز</span>
          </>
        ) : (
          <>
            <Moon className="w-4 h-4 text-indigo-600" />
            <span className="hidden sm:inline">حالت شب</span>
          </>
        )}
      </button>

      {/* Main Login Card with Glassmorphism */}
      <div
        className={`w-full max-w-md rounded-3xl p-6 sm:p-8 backdrop-blur-2xl shadow-2xl relative z-10 overflow-hidden transition-colors duration-300 ${
          theme === 'light'
            ? 'bg-white/95 border border-slate-200 shadow-2xl shadow-slate-900/15 text-slate-900'
            : 'bg-slate-900/90 border border-slate-800/90 shadow-2xl shadow-black/80 text-slate-100'
        }`}
      >
        {/* Glowing Top Accent Line */}
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-blue-500 via-cyan-400 to-amber-500" />

        {/* App Header */}
        <div className="flex flex-col items-center text-center mb-6 pt-1">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-amber-500 p-0.5 shadow-xl shadow-blue-500/25 mb-3.5 overflow-hidden flex items-center justify-center bg-slate-900">
            <img
              src={currentLogo}
              alt="لوگوی شبکه پخش عمده فرهودی"
              className="w-full h-full object-contain rounded-[14px]"
            />
          </div>
          <h1
            className={`text-lg sm:text-xl font-black tracking-tight text-center leading-relaxed ${
              theme === 'light' ? 'text-slate-900' : 'text-slate-50'
            }`}
          >
            بارفروش | شبکه پخش عمده فرهودی
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
                    ? theme === 'light'
                      ? 'bg-blue-100/90 border-blue-600 text-blue-900 font-extrabold shadow-sm'
                      : 'bg-blue-600/20 border-blue-500 text-blue-400 font-bold shadow-md shadow-blue-500/10'
                    : theme === 'light'
                      ? 'bg-slate-100 border-slate-300 text-slate-800 hover:bg-slate-200 hover:text-slate-950'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                <ShieldCheck className="w-4 h-4 text-blue-600" />
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
                    ? theme === 'light'
                      ? 'bg-indigo-100/90 border-indigo-600 text-indigo-900 font-extrabold shadow-sm'
                      : 'bg-indigo-600/20 border-indigo-500 text-indigo-400 font-bold shadow-md shadow-indigo-500/10'
                    : theme === 'light'
                      ? 'bg-slate-100 border-slate-300 text-slate-800 hover:bg-slate-200 hover:text-slate-950'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                <Warehouse className="w-4 h-4 text-indigo-600" />
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
                    ? theme === 'light'
                      ? 'bg-emerald-100/90 border-emerald-600 text-emerald-900 font-extrabold shadow-sm'
                      : 'bg-emerald-600/20 border-emerald-500 text-emerald-400 font-bold shadow-md shadow-emerald-500/10'
                    : theme === 'light'
                      ? 'bg-slate-100 border-slate-300 text-slate-800 hover:bg-slate-200 hover:text-slate-950'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                <Truck className="w-4 h-4 text-emerald-600" />
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
                    ? theme === 'light'
                      ? 'bg-amber-100/90 border-amber-600 text-amber-950 font-extrabold shadow-sm'
                      : 'bg-amber-600/20 border-amber-500 text-amber-400 font-bold shadow-md shadow-amber-500/10'
                    : theme === 'light'
                      ? 'bg-slate-100 border-slate-300 text-slate-800 hover:bg-slate-200 hover:text-slate-950'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                <Store className="w-4 h-4 text-amber-600" />
                <span>فروشگاه‌ها</span>
              </button>
            )}
          </div>
        )}

        {/* Section Identity Header - Centered */}
        <div
          className={`flex items-center justify-center gap-2 mb-5 pb-3 border-b text-sm font-extrabold text-center ${
            theme === 'light' ? 'text-slate-900 border-slate-200' : 'text-slate-100 border-slate-800/80'
          }`}
        >
          {currentTheme.icon}
          <span>{currentTheme.headerTitle}</span>
        </div>

        {/* Special Founder Discount Countdown Banner for Stores */}
        {activeTab === 'supermarket' && (
          <div
            className={`mb-4 px-2.5 py-2 sm:px-3 sm:py-2.5 rounded-xl border text-right shadow-sm animate-in fade-in duration-200 overflow-hidden ${
              theme === 'light'
                ? 'bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-emerald-500/10 border-amber-500/30'
                : 'bg-gradient-to-r from-amber-950/40 via-purple-950/30 to-emerald-950/30 border-amber-500/30 shadow-amber-950/20'
            }`}
          >
            <div className="flex items-center gap-1.5 whitespace-nowrap overflow-hidden">
              <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0 animate-pulse" />
              <span className={`text-[10px] sm:text-xs font-black whitespace-nowrap truncate leading-tight ${theme === 'light' ? 'text-amber-950' : 'text-amber-300'}`}>
                فقط {remainingFounderSpots.toLocaleString('fa-IR')} نفر دیگر شامل تخفیف ثبت نام اولیه خواهند شد.
              </span>
            </div>
            <p className={`text-[9px] sm:text-[11px] font-semibold whitespace-nowrap truncate leading-tight pr-5 mt-0.5 ${theme === 'light' ? 'text-slate-700' : 'text-slate-300'}`}>
              هرچه سریعتر ثبت نام کنید تا فرصت را از دست ندهید.
            </p>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleLoginSubmit} className="space-y-4">
          <div>
            <label
              className={`block text-xs font-extrabold mb-1.5 text-right ${
                theme === 'light' ? 'text-slate-900' : 'text-slate-300'
              }`}
            >
              شماره موبایل:
            </label>
            <div className="relative">
              <input
                id="login-username-input"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                dir="ltr"
                placeholder="۰۹۱۲۳۴۵۶۷۸۹"
                value={usernameInput}
                onChange={(e) => {
                  setUsernameInput(e.target.value);
                  setErrorMessage('');
                }}
                className={`w-full border rounded-xl px-3.5 py-2.5 pl-10 text-sm focus:outline-none transition font-mono text-left font-medium ${
                  theme === 'light'
                    ? 'bg-white border-slate-300 text-slate-900 focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 shadow-sm'
                    : 'bg-slate-950/90 border-slate-800 text-slate-100 focus:border-blue-500'
                }`}
              />
              <Phone
                className={`w-4 h-4 absolute left-3 top-3 pointer-events-none ${
                  theme === 'light' ? 'text-slate-500' : 'text-slate-500'
                }`}
              />
            </div>
            <p className={`text-[11px] mt-1 text-right ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>
              شماره تلفن همراه ۱۱ رقمی حساب کاربری (مثال: ۰۹۱۲۳۴۵۶۷۸۹)
            </p>
          </div>

          <div>
            <label
              className={`block text-xs font-extrabold mb-1.5 text-right ${
                theme === 'light' ? 'text-slate-900' : 'text-slate-300'
              }`}
            >
              رمز عبور:
            </label>
            <div className="relative">
              <input
                id="login-password-input"
                type="password"
                autoComplete="current-password"
                dir="ltr"
                placeholder=""
                value={passwordInput}
                onChange={(e) => {
                  setPasswordInput(e.target.value);
                  setErrorMessage('');
                }}
                className={`w-full border rounded-xl px-3.5 py-2.5 pl-10 text-sm focus:outline-none transition font-mono text-left font-medium ${
                  theme === 'light'
                    ? 'bg-white border-slate-300 text-slate-900 focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 shadow-sm'
                    : 'bg-slate-950/90 border-slate-800 text-slate-100 focus:border-blue-500'
                }`}
              />
              <KeyRound
                className={`w-4 h-4 absolute left-3 top-3 pointer-events-none ${
                  theme === 'light' ? 'text-slate-500' : 'text-slate-500'
                }`}
              />
            </div>
          </div>

          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-500 text-xs flex items-center gap-2 font-medium">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{errorMessage}</span>
            </div>
          )}

          <button
            id="login-submit-btn"
            type="submit"
            disabled={isSubmitting || isLoggingIn}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:scale-[0.99] text-white rounded-xl text-sm font-bold transition cursor-pointer shadow-lg shadow-blue-600/25 disabled:opacity-75 mt-2"
          >
            {isSubmitting || isLoggingIn ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>در حال ورود به سامانه...</span>
              </>
            ) : (
              <>
                <LogIn className="w-4 h-4" />
                <span>ورود به سامانه</span>
              </>
            )}
          </button>
        </form>

        {/* Supermarket registration card if on supermarket role (Compact & Sleek) */}
        {activeTab === 'supermarket' && (
          <div
            className={`mt-4 pt-3.5 border-t ${
              theme === 'light' ? 'border-slate-200' : 'border-slate-800/80'
            }`}
          >
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


      {/* Supermarket Registration Modal */}
      {isRegisterModalOpen && (
        <React.Suspense fallback={null}>
          <SupermarketRegisterModal
            isOpen={isRegisterModalOpen}
            onClose={() => setIsRegisterModalOpen(false)}
          />
        </React.Suspense>
      )}
    </div>
  );
};
