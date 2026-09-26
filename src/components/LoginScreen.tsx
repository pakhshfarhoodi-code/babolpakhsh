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
  HelpCircle,
} from 'lucide-react';
import { UserRole } from '../types';
import { SupermarketRegisterModal } from './SupermarketRegisterModal';

interface LoginScreenProps {
  initialRole?: UserRole;
  allowedRoles?: UserRole[];
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ initialRole, allowedRoles }) => {
  const { loginWithCredentials } = useApp();
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
  const [showDemoHelp, setShowDemoHelp] = useState(false);

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
          title: 'مدیریت مرکزی',
          color: 'blue',
          icon: <ShieldCheck className="w-5 h-5 text-blue-400" />,
          placeholder: 'admin یا شماره همراه',
          defaultHint: 'admin / 123',
        };
      case 'warehouse':
        return {
          title: 'انبار و سردخانه',
          color: 'indigo',
          icon: <Warehouse className="w-5 h-5 text-indigo-400" />,
          placeholder: 'warehouse یا شماره همراه',
          defaultHint: 'warehouse / 123',
        };
      case 'visitor':
        return {
          title: 'ویزیتورها',
          color: 'emerald',
          icon: <Truck className="w-5 h-5 text-emerald-400" />,
          placeholder: 'visitor1 یا شماره همراه',
          defaultHint: 'visitor1 تا visitor3 / 123',
        };
      case 'supermarket':
        return {
          title: 'فروشگاه‌ها',
          color: 'amber',
          icon: <Store className="w-5 h-5 text-amber-400" />,
          placeholder: 'shop1 یا شماره همراه فروشگاه',
          defaultHint: 'shop1 تا shop5 / 123',
        };
    }
  };

  const currentTheme = getRoleTheme(activeTab);

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-hidden">
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
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            ورود به حساب کاربری اختصاصی
          </p>
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
                    ? 'bg-blue-600/20 border-blue-500 text-blue-300 shadow-md'
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
                    ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300 shadow-md'
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
                    ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300 shadow-md'
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
                    ? 'bg-amber-600/20 border-amber-500 text-amber-300 shadow-md'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                <Store className="w-4 h-4 text-amber-400" />
                <span>فروشگاه‌ها</span>
              </button>
            )}
          </div>
        )}

        {/* Section Identity Header */}
        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-800/80 text-xs font-medium text-slate-300">
          {currentTheme.icon}
          <span>ورود به بخش {currentTheme.title}</span>
        </div>

        {/* Login Form */}
        <form onSubmit={handleLoginSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 text-right">
              نام کاربری، ایمیل یا شماره همراه:
            </label>
            <div className="relative">
              <input
                id="login-username-input"
                type="text"
                autoComplete="username"
                dir="ltr"
                placeholder={currentTheme.placeholder}
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
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-300 text-right">
                رمز عبور:
              </label>
              <button
                type="button"
                onClick={() => setShowDemoHelp(!showDemoHelp)}
                className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 cursor-pointer transition"
              >
                <HelpCircle className="w-3 h-3" />
                <span>حساب‌های پیش‌فرض؟</span>
              </button>
            </div>
            <div className="relative">
              <input
                id="login-password-input"
                type="password"
                autoComplete="current-password"
                dir="ltr"
                placeholder="رمز عبور..."
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

          {/* Quick Demo Credentials Guide */}
          {showDemoHelp && (
            <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl text-xs space-y-1 text-slate-400 animate-in fade-in duration-200">
              <div className="font-semibold text-slate-300 text-right">اطلاعات ورود پیش‌فرض سیستم:</div>
              <div className="flex justify-between font-mono dir-ltr text-xs pt-1 border-t border-slate-800/80">
                <span className="text-blue-400">admin / 123</span>
                <span className="text-slate-400">مدیریت:</span>
              </div>
              <div className="flex justify-between font-mono dir-ltr text-xs">
                <span className="text-indigo-400">warehouse / 123</span>
                <span className="text-slate-400">انباردار:</span>
              </div>
              <div className="flex justify-between font-mono dir-ltr text-xs">
                <span className="text-emerald-400">visitor1 یا visitor2 / 123</span>
                <span className="text-slate-400">ویزیتور:</span>
              </div>
              <div className="flex justify-between font-mono dir-ltr text-xs">
                <span className="text-amber-400">shop1 تا shop5 / 123</span>
                <span className="text-slate-400">فروشگاه:</span>
              </div>
            </div>
          )}

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

        {/* Supermarket registration banner if on supermarket role */}
        {activeTab === 'supermarket' && (
          <div className="mt-5 pt-4 border-t border-slate-800/80 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400 px-1">
              <span>فروشگاه شما هنوز در سامانه ثبت نشده؟</span>
              <span className="text-xs text-amber-400/90 font-medium">سفارش مستقیم و آسان</span>
            </div>
            <button
              id="register-supermarket-bottom-btn"
              type="button"
              onClick={() => setIsRegisterModalOpen(true)}
              className="w-full group relative overflow-hidden flex items-center justify-between p-3.5 rounded-xl bg-gradient-to-r from-amber-500/15 via-amber-500/10 to-amber-600/20 hover:from-amber-500/25 hover:via-amber-500/20 hover:to-amber-600/30 border border-amber-500/40 hover:border-amber-400 text-amber-300 transition-all duration-200 cursor-pointer shadow-md hover:shadow-amber-500/10"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 group-hover:scale-110 transition-transform">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div className="text-right">
                  <div className="text-xs font-bold text-amber-200 group-hover:text-amber-100 transition-colors">
                    ثبت‌نام آنلاین فروشگاه
                  </div>
                  <div className="text-xs text-amber-400/70">
                    ثبت فوری سفارش و دریافت کد اختصاصی
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 text-xs font-semibold text-amber-400 group-hover:text-amber-300">
                <span className="text-xs">شروع ثبت‌نام</span>
                <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
              </div>
            </button>
          </div>
        )}
      </div>

      <div className="text-xs text-slate-500 mt-6 text-center">
        سامانه مدیریت توزیع و زنجیره سرد البرز — احراز هویت با نام کاربری و کلمه عبور
      </div>

      {/* Supermarket Registration Modal */}
      <SupermarketRegisterModal
        isOpen={isRegisterModalOpen}
        onClose={() => setIsRegisterModalOpen(false)}
      />
    </div>
  );
};
