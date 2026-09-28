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

export const App: React.FC = () => {
  const { role, setRole, isLoggedIn } = useApp();
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
