import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from './context/AppContext';
import { Header } from './components/Header';
import { AdminPanel } from './components/AdminPanel';
import { VisitorPortal } from './components/VisitorPortal';
import { SupermarketPortal } from './components/SupermarketPortal';
import { WarehousePanel } from './components/WarehousePanel';
import { LoginScreen } from './components/LoginScreen';
import { UserRole } from './types';

// Helper to determine route key from window.location.pathname
function getNormalizedPath(): string {
  if (typeof window === 'undefined') return '/';
  const raw = window.location.pathname.toLowerCase();
  if (raw.startsWith('/admin')) return '/admin';
  if (raw.startsWith('/visitor')) return '/visitor';
  return '/';
}

export const App: React.FC = () => {
  const { role, setRole, isLoggedIn } = useApp();
  const [currentPath, setCurrentPath] = useState<string>(getNormalizedPath);

  // Synchronize route changes via popstate and custom navigation
  const navigateTo = useCallback((targetPath: string) => {
    if (typeof window !== 'undefined' && window.location.pathname !== targetPath) {
      window.history.pushState({}, '', targetPath);
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

  // Auto-sync active role based on current URL path
  useEffect(() => {
    if (currentPath === '/admin') {
      if (role === 'supermarket') {
        navigateTo('/');
      } else if (role !== 'admin' && role !== 'warehouse') {
        setRole('admin');
      }
    } else if (currentPath === '/visitor') {
      if (role === 'supermarket') {
        navigateTo('/');
      } else if (role !== 'visitor') {
        setRole('visitor');
      }
    } else {
      // Root '/' is dedicated to supermarkets
      if (role !== 'supermarket') {
        setRole('supermarket');
      }
    }
  }, [currentPath, role, setRole, navigateTo]);

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
      <Header currentPath={currentPath} onNavigate={navigateTo} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6">
        {currentPath === '/admin' ? (
          role === 'warehouse' ? <WarehousePanel /> : <AdminPanel />
        ) : currentPath === '/visitor' ? (
          <VisitorPortal />
        ) : (
          <SupermarketPortal />
        )}
      </main>

      <footer className="border-t border-slate-900 bg-slate-950/80 py-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-wrap items-center justify-between gap-2">
          <span>سامانه مدیریت سفارش و پخش مویرگی البرز — نسخه سازمانی توزیع زنجیره سرد</span>
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
