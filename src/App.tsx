import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from './context/AppContext';
import { Header } from './components/Header';
import { AdminPanel } from './components/AdminPanel';
import { VisitorPortal } from './components/VisitorPortal';
import { SupermarketPortal } from './components/SupermarketPortal';
import { WarehousePanel } from './components/WarehousePanel';
import { LoginScreen } from './components/LoginScreen';
import { UserRole } from './types';

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

import { AlertTriangle, RefreshCw, Loader2 } from 'lucide-react';

export const App: React.FC = () => {
  const { role, setRole, isLoggedIn, isOnlineDb, isDataReady, fetchError, retryFetch } = useApp();
  const [currentPath, setCurrentPath] = useState<string>(getNormalizedPath);
  const [adminActiveTab, setAdminActiveTab] = useState<'overview' | 'orders' | 'products' | 'team' | 'reports'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('pakhsh_admin_active_tab');
      if (saved) return saved as any;
    }
    return 'overview';
  });
  const [warehouseActiveTab, setWarehouseActiveTab] = useState<'pending' | 'history'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('pakhsh_warehouse_active_tab');
      if (saved) return saved as any;
    }
    return 'pending';
  });

  useEffect(() => {
    localStorage.setItem('pakhsh_admin_active_tab', adminActiveTab);
  }, [adminActiveTab]);

  useEffect(() => {
    localStorage.setItem('pakhsh_warehouse_active_tab', warehouseActiveTab);
  }, [warehouseActiveTab]);

  // Synchronize route changes via popstate and custom navigation
  const navigateTo = useCallback((targetPath: string) => {
    if (typeof window !== 'undefined') {
      const base = getBasePath();
      const fullPath = targetPath === '/' ? (base ? `${base}/` : '/') : `${base}${targetPath}`;
      const currentNorm = window.location.pathname.replace(/\/+$/, '');
      const targetNorm = fullPath.replace(/\/+$/, '');
      if (currentNorm !== targetNorm) {
        window.history.pushState({}, '', fullPath);
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

  // Route Guard: Ensure logged-in user is redirected to their authorized route
  useEffect(() => {
    if (!isLoggedIn) return;

    if (role === 'visitor') {
      if (currentPath !== '/visitor') {
        navigateTo('/visitor');
      }
    } else if (role === 'supermarket') {
      if (currentPath !== '/') {
        navigateTo('/');
      }
    } else if (role === 'admin' || role === 'warehouse') {
      if (currentPath !== '/admin') {
        navigateTo('/admin');
      }
    }
  }, [currentPath, role, isLoggedIn, navigateTo]);

  // If user is not logged in, show tailored login screen for the route
  if (!isLoggedIn) {
    if (currentPath === '/admin') {
      return (
        <LoginScreen
          initialRole="admin"
          allowedRoles={['admin', 'warehouse']}
        />
      );
    }
    if (currentPath === '/visitor') {
      return (
        <LoginScreen
          initialRole="visitor"
          allowedRoles={['visitor']}
        />
      );
    }
    // Default '/' is supermarkets
    return (
      <LoginScreen
        initialRole="supermarket"
        allowedRoles={['supermarket']}
      />
    );
  }

  // Database-first Fetch Error Screen
  if (isOnlineDb && fetchError) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-blue-600 selection:text-white">
        <Header currentPath={currentPath} onNavigate={navigateTo} />
        <main className="flex-1 max-w-xl w-full mx-auto px-4 py-16 flex items-center justify-center">
          <div className="w-full bg-rose-950/40 border border-rose-800/80 rounded-3xl p-8 text-center shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-rose-900/50 rounded-2xl flex items-center justify-center mx-auto mb-5 border border-rose-700/60 shadow-lg text-rose-400">
              <AlertTriangle className="w-8 h-8 animate-bounce" />
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-rose-200 mb-2">
              اتصال به سرور برقرار نشد
            </h2>
            <p className="text-xs sm:text-sm text-rose-300/80 mb-6 font-medium leading-relaxed">
              ارتباط با پایگاه داده Supabase برقرار نشد. لطفاً وضعیت اینترنت را بررسی کرده و مجدداً تلاش فرمایید.
            </p>
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

  // Database-first Loading Skeleton
  if (isOnlineDb && !isDataReady) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-blue-600 selection:text-white">
        <Header currentPath={currentPath} onNavigate={navigateTo} />
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 space-y-6">
          <div className="flex items-center justify-between gap-4 p-4 rounded-2xl bg-slate-900/60 border border-slate-800 animate-pulse">
            <div className="flex items-center gap-3">
              <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
              <div className="h-5 w-48 bg-slate-800 rounded-lg"></div>
            </div>
            <div className="h-5 w-24 bg-slate-800 rounded-lg"></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-28 rounded-2xl bg-slate-900/40 border border-slate-800/80 p-4 flex flex-col justify-between animate-pulse"
              >
                <div className="h-4 w-24 bg-slate-800 rounded"></div>
                <div className="h-8 w-32 bg-slate-800 rounded-lg"></div>
              </div>
            ))}
          </div>
          <div className="h-96 rounded-2xl bg-slate-900/40 border border-slate-800/80 p-6 flex flex-col gap-4 animate-pulse">
            <div className="h-6 w-40 bg-slate-800 rounded"></div>
            <div className="h-full bg-slate-800/30 rounded-xl"></div>
          </div>
        </main>
      </div>
    );
  }

  // Render main screen matching the route
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-blue-600 selection:text-white">
      <Header
        currentPath={currentPath}
        onNavigate={navigateTo}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6">
        {currentPath === '/admin' ? (
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
        ) : currentPath === '/visitor' ? (
          <VisitorPortal />
        ) : (
          <SupermarketPortal />
        )}
      </main>

      <footer className="border-t border-slate-900 bg-slate-950/80 py-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-wrap items-center justify-between gap-2">
          <span>بارفروش | شبکه پخش عمده فرهودی — سامانه جامع مدیریت سفارش و توزیع</span>
          {role !== 'supermarket' && (
            <div className="flex items-center gap-3 text-xs font-mono">
              <button
                onClick={() => navigateTo('/')}
                className={`hover:text-amber-400 transition cursor-pointer ${
                  currentPath === '/' ? 'text-amber-400 font-bold underline' : 'text-slate-500'
                }`}
              >
                / (فروشگاه‌ها)
              </button>
              <span className="text-slate-700">|</span>
              <button
                onClick={() => navigateTo('/visitor')}
                className={`hover:text-emerald-400 transition cursor-pointer ${
                  currentPath === '/visitor' ? 'text-emerald-400 font-bold underline' : 'text-slate-500'
                }`}
              >
                /visitor (ویزیتورها)
              </button>
              <span className="text-slate-700">|</span>
              <button
                onClick={() => navigateTo('/admin')}
                className={`hover:text-blue-400 transition cursor-pointer ${
                  currentPath === '/admin' ? 'text-blue-400 font-bold underline' : 'text-slate-500'
                }`}
              >
                /admin (مدیر و انبار)
              </button>
            </div>
          )}
        </div>
      </footer>
    </div>
  );
};
