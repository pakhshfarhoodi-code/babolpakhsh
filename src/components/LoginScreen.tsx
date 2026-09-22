import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { INITIAL_PROFILES } from '../data/initialData';
import {
  ShieldCheck,
  Truck,
  Store,
  Warehouse,
  ThermometerSnowflake,
  LogIn,
  Phone,
  UserCheck,
  ChevronLeft,
} from 'lucide-react';
import { UserRole } from '../types';

export const LoginScreen: React.FC = () => {
  const { login } = useApp();
  const [activeTab, setActiveTab] = useState<UserRole>('admin');
  const [phoneInput, setPhoneInput] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const filteredProfiles = INITIAL_PROFILES.filter((p) => p.role === activeTab);

  const handlePhoneLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    const cleanPhone = phoneInput.trim().replace(/\s+/g, '');
    const matched = INITIAL_PROFILES.find(
      (p) => p.phone === cleanPhone || p.phone.replace(/۰/g, '0').replace(/۱/g, '1').replace(/۲/g, '2').replace(/۳/g, '3').replace(/۴/g, '4').replace(/۵/g, '5').replace(/۶/g, '6').replace(/۷/g, '7').replace(/۸/g, '8').replace(/۹/g, '9') === cleanPhone
    );

    if (matched) {
      login(matched.id);
    } else {
      setErrorMessage('شماره همراه در لیست حساب‌های مجاز یافت نشد.');
    }
  };

  const getRoleIcon = (role: UserRole) => {
    switch (role) {
      case 'admin':
        return <ShieldCheck className="w-5 h-5 text-blue-400" />;
      case 'visitor':
        return <Truck className="w-5 h-5 text-emerald-400" />;
      case 'supermarket':
        return <Store className="w-5 h-5 text-amber-400" />;
      case 'warehouse':
        return <Warehouse className="w-5 h-5 text-indigo-400" />;
    }
  };

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'admin':
        return 'مدیریت مرکزی';
      case 'visitor':
        return 'ویزیتور';
      case 'supermarket':
        return 'فروشگاه طرف قرارداد';
      case 'warehouse':
        return 'انبار و سردخانه';
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 sm:p-6 text-slate-100">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(59,130,246,0.12),rgba(255,255,255,0))] pointer-events-none" />

      <div className="w-full max-w-2xl bg-slate-900/90 border border-slate-800 rounded-2xl p-6 sm:p-8 backdrop-blur-xl shadow-2xl relative z-10">
        {/* App Header */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400 mb-3 shadow-lg shadow-blue-500/10">
            <ThermometerSnowflake className="w-7 h-7 animate-pulse text-blue-400" />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-100 tracking-tight">
            سامانه مدیریت و پخش مویرگی البرز
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            ورود به پرتال توزیع زنجیره سرد و ثبت سفارشات
          </p>
        </div>

        {/* Role Category Tabs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-6">
          <button
            type="button"
            onClick={() => {
              setActiveTab('admin');
              setErrorMessage('');
            }}
            className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border text-xs font-semibold transition cursor-pointer ${
              activeTab === 'admin'
                ? 'bg-blue-600/15 border-blue-500 text-blue-300 shadow-md'
                : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
            }`}
          >
            <ShieldCheck className="w-5 h-5 text-blue-400" />
            <span>مدیر ارشد</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('visitor');
              setErrorMessage('');
            }}
            className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border text-xs font-semibold transition cursor-pointer ${
              activeTab === 'visitor'
                ? 'bg-emerald-600/15 border-emerald-500 text-emerald-300 shadow-md'
                : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
            }`}
          >
            <Truck className="w-5 h-5 text-emerald-400" />
            <span>ویزیتورها</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('supermarket');
              setErrorMessage('');
            }}
            className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border text-xs font-semibold transition cursor-pointer ${
              activeTab === 'supermarket'
                ? 'bg-amber-600/15 border-amber-500 text-amber-300 shadow-md'
                : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
            }`}
          >
            <Store className="w-5 h-5 text-amber-400" />
            <span>فروشگاه‌ها</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('warehouse');
              setErrorMessage('');
            }}
            className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border text-xs font-semibold transition cursor-pointer ${
              activeTab === 'warehouse'
                ? 'bg-indigo-600/15 border-indigo-500 text-indigo-300 shadow-md'
                : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
            }`}
          >
            <Warehouse className="w-5 h-5 text-indigo-400" />
            <span>انبار و سردخانه</span>
          </button>
        </div>

        {/* Profile List */}
        <div className="space-y-2.5 mb-6">
          <div className="text-xs text-slate-400 mb-2 flex items-center justify-between">
            <span>حساب‌های کاربری موجود در بخش {getRoleBadge(activeTab)}:</span>
            <span className="text-[11px] text-slate-500">برای ورود روی حساب کلیک فرمایید</span>
          </div>

          {filteredProfiles.map((p) => (
            <button
              key={p.id}
              onClick={() => login(p.id)}
              className="w-full flex items-center justify-between p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-blue-500/60 hover:bg-blue-950/20 text-right transition cursor-pointer group"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-slate-800 flex items-center justify-center group-hover:scale-105 transition">
                  {getRoleIcon(p.role)}
                </div>
                <div>
                  <div className="font-semibold text-slate-100 text-sm group-hover:text-blue-300 transition">
                    {p.name}
                  </div>
                  <div className="text-xs text-slate-400 font-mono flex items-center gap-1 mt-0.5">
                    <Phone className="w-3 h-3 text-slate-500" />
                    <span>{p.phone}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-slate-400 group-hover:text-blue-400 transition hidden sm:inline">
                  ورود به حساب
                </span>
                <div className="w-7 h-7 rounded-lg bg-slate-800 group-hover:bg-blue-600 text-slate-400 group-hover:text-white flex items-center justify-center transition">
                  <ChevronLeft className="w-4 h-4" />
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Quick Phone login fallback */}
        <form onSubmit={handlePhoneLogin} className="pt-5 border-t border-slate-800/80">
          <label className="block text-xs font-medium text-slate-300 mb-1.5">
            یا ورود مستقیم با شماره تلفن همراه:
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="مثال: ۰۹۱۲۳۴۵۶۷۸۹"
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value)}
              className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono text-left"
              dir="ltr"
            />
            <button
              type="submit"
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold transition cursor-pointer"
            >
              <LogIn className="w-4 h-4" />
              <span>ورود</span>
            </button>
          </div>
          {errorMessage && (
            <p className="text-xs text-rose-400 mt-2 font-medium">{errorMessage}</p>
          )}
        </form>
      </div>

      <div className="text-xs text-slate-500 mt-6 text-center">
        سامانه مدیریت توزیع و زنجیره سرد البرز — ارتباط هوشمند انبار، ویزیتورها و فروشگاه‌ها
      </div>
    </div>
  );
};
