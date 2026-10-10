import React, { useState, useEffect, useCallback, Suspense, lazy } from 'react';
import { useApp } from './context/AppContext';
import { Header } from './components/Header';
import type { AdminTabKey } from './components/AdminPanel';
import { LoginScreen } from './components/LoginScreen';
import { UserRole } from './types';
import { getMessengerScope } from './lib/messengerScope';
import appLogo from './assets/images/farhoodi_b2b_logo.webp';

const AdminPanel = lazy(() => import('./components/AdminPanel').then((m) => ({ default: m.AdminPanel })));
const VisitorPortal = lazy(() => import('./components/VisitorPortal').then((m) => ({ default: m.VisitorPortal })));
const SupermarketPortal = lazy(() => import('./components/SupermarketPortal').then((m) => ({ default: m.SupermarketPortal })));
const WarehousePanel = lazy(() => import('./components/WarehousePanel').then((m) => ({ default: m.WarehousePanel })));
import { AlertTriangle, RefreshCw, Loader2 } from 'lucide-react';

// Helper to detect base path (e.g. '/babolpakhsh' on GitHub Pages or '' for root/ArvanCloud)
function getBasePath(): string {
  if (typeof window === 'undefined') return '';
  const pathname = window.location.pathname.toLowerCase();
  if (pathname.startsWith('/babolpakhsh')) {
    return '/babolpakhsh';
  }
  const viteBase = import.meta.env.BASE_URL;
  if (viteBase && viteBase !== './' && viteBase !== '/') {
    return viteBase.replace(/\/+$/, '');
  }
  return '';
}

// Helper to determine route key from window.location.pathname
function getNormalizedPath(): string {
  if (typeof window === 'undefined') return '/';
  const raw = window.location.pathname.toLowerCase().replace(/\/+$/, '');
  if (raw.endsWith('/admin') || raw === '/admin') return '/admin';
  if (raw.endsWith('/visitor') || raw === '/visitor') return '/visitor';
  return '/';
}

function getExpectedPathForRole(userRole: UserRole): string {
  if (userRole === 'visitor') return '/visitor';
  if (userRole === 'admin' || userRole === 'warehouse') return '/admin';
  return '/';
}

export const App: React.FC = () => {
  const {
    role,
    isLoggedIn,
    authReady,
    isOnlineDb,
    isDataReady,
    fetchError,
    retryFetch,
    theme,
    invoiceSettings,
  } = useApp();

  const currentLogo = invoiceSettings?.logo_url || appLogo;

  const [currentPath, setCurrentPath] = useState<string>(getNormalizedPath);
  const [justLoggedIn, setJustLoggedIn] = useState(false);

  const [adminActiveTab, setAdminActiveTab] = useState<AdminTabKey>('overview');

  const [warehouseActiveTab, setWarehouseActiveTab] = useState<'pending' | 'history'>('pending');

  const [showStaffLogin, setShowStaffLogin] = useState<boolean>(
    () => typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('staff') === '1'
  );

  // Clear any legacy cached active tabs so default tabs always take effect
  useEffect(() => {
    try {
      localStorage.removeItem('pakhsh_admin_active_tab');
      localStorage.removeItem('pakhsh_supermarket_active_tab');
      localStorage.removeItem('pakhsh_visitor_active_tab');
    } catch {}
  }, []);

  // Whenever admin logs in or route is entered, ensure default tab is 'overview' (نیازمند بررسی)
  useEffect(() => {
    if (isLoggedIn && role === 'admin') {
      setAdminActiveTab('overview');
    }
  }, [isLoggedIn, role]);

  // Synchronize route changes via replaceState without redundant history entries
  const navigateTo = useCallback((targetPath: string) => {
    if (typeof window !== 'undefined') {
      const base = getBasePath();
      const fullPath = targetPath === '/' ? (base ? `${base}/` : '/') : `${base}${targetPath}`;
      const currentNorm = window.location.pathname.replace(/\/+$/, '');
      const targetNorm = fullPath.replace(/\/+$/, '');
      if (currentNorm !== targetNorm) {
        window.history.replaceState({}, '', fullPath);
      }
    }
    setCurrentPath(targetPath);
  }, []);

  // Listen for browser back / forward navigation
  useEffect(() => {
    const handlePopState = () => {
      const path = getNormalizedPath();
      setCurrentPath(path);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Synchronous Route Guard calculation in render (Point 5)
  const expectedPath = isLoggedIn ? getExpectedPathForRole(role) : currentPath;

  if (isLoggedIn && currentPath !== expectedPath) {
    if (typeof window !== 'undefined') {
      const base = getBasePath();
      const fullPath = expectedPath === '/' ? (base ? `${base}/` : '/') : `${base}${expectedPath}`;
      window.history.replaceState({}, '', fullPath);
    }
  }

  const effectivePath = isLoggedIn ? expectedPath : currentPath;

  // 1. Initial Startup Splash Screen (Point 2: shown until authReady is true)
  if (!authReady) {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center p-4 transition-colors duration-200 ${
        theme === 'light' ? 'bg-slate-100 text-slate-900' : 'bg-slate-950 text-slate-100'
      }`}>
        <div className="flex flex-col items-center gap-4 animate-in fade-in duration-300">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden shadow-xl border border-slate-700/40 bg-slate-900 flex items-center justify-center p-2">
            <img src={currentLogo} alt="بارفروش" className="w-full h-full object-contain" />
          </div>
          <div className="flex items-center gap-2">
            <Loader2 className={`w-5 h-5 animate-spin ${theme === 'light' ? 'text-blue-600' : 'text-blue-400'}`} />
            <span className="text-xs font-semibold opacity-80">در حال راه‌اندازی سامانه...</span>
          </div>
        </div>
      </div>
    );
  }

  // 2. Unauthenticated or in the middle of fresh login from LoginScreen (Point 3)
  if (!isLoggedIn || justLoggedIn) {
    const isInsideMessenger =
      typeof window !== 'undefined' &&
      (Boolean((window as any).Eitaa?.WebApp?.initData) ||
        Boolean((window as any).Telegram?.WebApp?.initData) ||
        Boolean(getMessengerScope()));
    const initialRole = effectivePath === '/admin' ? 'admin' : (effectivePath === '/visitor' ? 'visitor' : 'supermarket');
    const allowedRoles = effectivePath === '/admin'
      ? ['admin', 'warehouse']
      : (effectivePath === '/visitor'
          ? ['visitor']
          : (isInsideMessenger && showStaffLogin ? ['supermarket', 'visitor', 'admin', 'warehouse'] : ['supermarket']));

    return (
      <>
        <LoginScreen
          key={showStaffLogin ? 'staff' : 'store'}
          initialRole={initialRole as UserRole}
          allowedRoles={allowedRoles as UserRole[]}
          onLoginStart={() => setJustLoggedIn(true)}
          onLoginComplete={() => setJustLoggedIn(false)}
        />
        {isInsideMessenger && effectivePath === '/' && (
          <button
            type="button"
            onClick={() => setShowStaffLogin((v) => !v)}
            className="fixed bottom-3 left-1/2 -translate-x-1/2 z-50 text-[11px] text-slate-500 underline"
          >
            {showStaffLogin ? 'بازگشت به ورود فروشگاه' : 'ورود ادمین / ویزیتور'}
          </button>
        )}
      </>
    );
  }

  // 3. Database-first Fetch Error Screen: ONLY when fetchError is non-empty
  if (isOnlineDb && Boolean(fetchError)) {
    return (
      <div className={`min-h-screen flex flex-col selection:bg-blue-600 selection:text-white ${
        theme === 'light' ? 'bg-slate-100 text-slate-900' : 'bg-slate-950 text-slate-100'
      }`}>
        <Header currentPath={effectivePath} onNavigate={navigateTo} />
        <main className="flex-1 max-w-xl w-full mx-auto px-4 py-16 flex items-center justify-center">
          <div className="w-full bg-rose-950/40 border border-rose-800/80 rounded-3xl p-8 text-center shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-rose-900/50 rounded-2xl flex items-center justify-center mx-auto mb-5 border border-rose-700/60 shadow-lg text-rose-400">
              <AlertTriangle className="w-8 h-8 animate-bounce" />
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-rose-200 mb-2">
              اتصال به سرور برقرار نشد
            </h2>
            <p className="text-xs sm:text-sm text-rose-300/80 mb-3 font-medium leading-relaxed">
              ارتباط با پایگاه داده Supabase برقرار نشد. لطفاً وضعیت اینترنت را بررسی کرده و مجدداً تلاش فرمایید.
            </p>
            {fetchError && (
              <p className="text-[11px] text-slate-400 font-mono mb-6 bg-slate-900/60 p-2.5 rounded-xl border border-rose-900/40 break-words dir-ltr text-center">
                {fetchError}
              </p>
            )}
            <button
              type="button"
              onClick={retryFetch}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white font-bold shadow-lg shadow-rose-950/50 transition cursor-pointer active:scale-95 flex items-center justify-center gap-2 mx-auto"
            >
              <RefreshCw className="w-4 h-4" />
              <span>تلاش مجدد</span>
            </button>
          </div>
        </main>
      </div>
    );
  }

  // 4. Database-first Loading Skeleton: displayed ONLY on page refresh (isDataReady=false and not fresh login)
  if (isOnlineDb && !isDataReady && !fetchError) {
    return (
      <div className={`min-h-screen flex flex-col selection:bg-blue-600 selection:text-white ${
        theme === 'light' ? 'bg-slate-100 text-slate-900' : 'bg-slate-950 text-slate-100'
      }`}>
        <Header currentPath={effectivePath} onNavigate={navigateTo} />
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 space-y-6">
          <div className={`flex items-center justify-between gap-4 p-4 rounded-2xl border animate-pulse ${
            theme === 'light' ? 'bg-white border-slate-200' : 'bg-slate-900/60 border-slate-800'
          }`}>
            <div className="flex items-center gap-3">
              <Loader2 className={`w-5 h-5 animate-spin ${theme === 'light' ? 'text-blue-600' : 'text-blue-400'}`} />
              <div className={`h-5 w-48 rounded-lg ${theme === 'light' ? 'bg-slate-200' : 'bg-slate-800'}`}></div>
            </div>
            <div className={`h-5 w-24 rounded-lg ${theme === 'light' ? 'bg-slate-200' : 'bg-slate-800'}`}></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className={`h-28 rounded-2xl border p-4 flex flex-col justify-between animate-pulse ${
                  theme === 'light' ? 'bg-white border-slate-200' : 'bg-slate-900/40 border-slate-800/80'
                }`}
              >
                <div className={`h-4 w-24 rounded ${theme === 'light' ? 'bg-slate-200' : 'bg-slate-800'}`}></div>
                <div className={`h-8 w-32 rounded-lg ${theme === 'light' ? 'bg-slate-200' : 'bg-slate-800'}`}></div>
              </div>
            ))}
          </div>
          <div className={`h-96 rounded-2xl border p-6 flex flex-col gap-4 animate-pulse ${
            theme === 'light' ? 'bg-white border-slate-200' : 'bg-slate-900/40 border-slate-800/80'
          }`}>
            <div className={`h-6 w-40 rounded ${theme === 'light' ? 'bg-slate-200' : 'bg-slate-800'}`}></div>
            <div className={`h-full rounded-xl ${theme === 'light' ? 'bg-slate-100' : 'bg-slate-800/30'}`}></div>
          </div>
        </main>
      </div>
    );
  }

  // 5. Render main screen matching the route
  return (
    <div className={`min-h-screen flex flex-col selection:bg-blue-600 selection:text-white ${
      theme === 'light' ? 'bg-slate-100 text-slate-900' : 'bg-slate-950 text-slate-100'
    }`}>
      <Header
        currentPath={effectivePath}
        onNavigate={navigateTo}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6">
        <Suspense
          fallback={
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 className={`w-8 h-8 animate-spin ${theme === 'light' ? 'text-blue-600' : 'text-blue-400'}`} />
              <span className="text-xs font-medium opacity-70">در حال بارگذاری بخش مورد نظر...</span>
            </div>
          }
        >
          {effectivePath === '/admin' ? (
            role === 'warehouse' ? (
              <WarehousePanel
                activeTab={warehouseActiveTab}
                onTabChange={setWarehouseActiveTab}
              />
            ) : (
              <AdminPanel
                activeTab={adminActiveTab}
                onTabChange={setAdminActiveTab}
              />
            )
          ) : effectivePath === '/visitor' ? (
            <VisitorPortal />
          ) : (
            <SupermarketPortal />
          )}
        </Suspense>
      </main>
    </div>
  );
};
