import React, { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useApp } from './context/AppContext';
import { Header } from './components/Header';
import type { AdminTabKey } from './components/AdminPanel';
import { LoginScreen } from './components/LoginScreen';
import { Order, UserRole } from './types';
import { getMessengerScope } from './lib/messengerScope';
import { lazyWithRetry } from './lib/chunkReload';
import { supabase } from './lib/supabase';
import { getOrderChannel } from './context/utils';
import appLogo from './assets/images/farhoodi_b2b_logo.webp';

const AdminPanel = lazyWithRetry(() => import('./components/AdminPanel').then((m) => ({ default: m.AdminPanel })));
const VisitorPortal = lazyWithRetry(() => import('./components/VisitorPortal').then((m) => ({ default: m.VisitorPortal })));
const SupermarketPortal = lazyWithRetry(() => import('./components/SupermarketPortal').then((m) => ({ default: m.SupermarketPortal })));
const WarehousePanel = lazyWithRetry(() => import('./components/WarehousePanel').then((m) => ({ default: m.WarehousePanel })));
const OrderInvoiceModal = lazyWithRetry(() =>
  import('./components/invoice/OrderInvoiceModal').then((m) => ({ default: m.OrderInvoiceModal }))
);
import { ForcePasswordChangeModal } from './components/ForcePasswordChangeModal';
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

function getInvoiceParamFromUrl(): { hasParam: boolean; orderId: string } {
  if (typeof window === 'undefined') return { hasParam: false, orderId: '' };
  try {
    const params = new URLSearchParams(window.location.search);
    if (!params.has('invoice')) return { hasParam: false, orderId: '' };
    return { hasParam: true, orderId: (params.get('invoice') || '').trim() };
  } catch {
    return { hasParam: false, orderId: '' };
  }
}

function removeInvoiceParamFromUrl(): void {
  if (typeof window === 'undefined') return;
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.has('invoice')) {
      url.searchParams.delete('invoice');
      window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
    }
  } catch {}
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
    mustChangePassword,
    currentUser,
    selectedVisitorId,
    selectedSupermarketId,
    supermarkets,
    visitors,
    orders,
    showToast,
  } = useApp();

  const currentLogo = invoiceSettings?.logo_url || appLogo;

  const [currentPath, setCurrentPath] = useState<string>(getNormalizedPath);
  const [justLoggedIn, setJustLoggedIn] = useState(false);

  const [adminActiveTab, setAdminActiveTab] = useState<AdminTabKey>('overview');

  const [warehouseActiveTab, setWarehouseActiveTab] = useState<'pending' | 'history'>('pending');

  const [showStaffLogin, setShowStaffLogin] = useState<boolean>(
    () => typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('staff') === '1'
  );

  const [pendingInvoice, setPendingInvoice] = useState<{ hasParam: boolean; orderId: string }>(getInvoiceParamFromUrl);
  const [deepLinkOrder, setDeepLinkOrder] = useState<Order | null>(null);
  const [isLoadingDeepLinkInvoice, setIsLoadingDeepLinkInvoice] = useState(false);
  const handledInvoiceKeyRef = useRef<string | null>(null);

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

  // Reset deep-link state on logout
  useEffect(() => {
    if (!isLoggedIn) {
      setDeepLinkOrder(null);
      setIsLoadingDeepLinkInvoice(false);
      handledInvoiceKeyRef.current = null;
    }
  }, [isLoggedIn]);

  // Synchronize route changes via replaceState without redundant history entries
  const navigateTo = useCallback((targetPath: string) => {
    if (typeof window !== 'undefined') {
      const base = getBasePath();
      const fullPath = targetPath === '/' ? (base ? `${base}/` : '/') : `${base}${targetPath}`;
      const currentNorm = window.location.pathname.replace(/\/+$/, '');
      const targetNorm = fullPath.replace(/\/+$/, '');
      if (currentNorm !== targetNorm) {
        const search = window.location.search || '';
        const hash = window.location.hash || '';
        window.history.replaceState({}, '', `${fullPath}${search}${hash}`);
      }
    }
    setCurrentPath(targetPath);
  }, []);

  // Listen for browser back / forward navigation
  useEffect(() => {
    const handlePopState = () => {
      const path = getNormalizedPath();
      setCurrentPath(path);
      const nextInv = getInvoiceParamFromUrl();
      if (nextInv.hasParam) {
        handledInvoiceKeyRef.current = null;
        setPendingInvoice(nextInv);
      }
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
      const search = window.location.search || '';
      const hash = window.location.hash || '';
      window.history.replaceState({}, '', `${fullPath}${search}${hash}`);
    }
  }

  const effectivePath = isLoggedIn ? expectedPath : currentPath;

  // Handle ?invoice=<orderId> deep-link after authentication and data readiness
  useEffect(() => {
    if (!pendingInvoice.hasParam) return;
    if (!authReady || !isLoggedIn || justLoggedIn) return;
    if (isOnlineDb && (!isDataReady || Boolean(fetchError))) return;

    const orderId = pendingInvoice.orderId;
    const handleKey = `${role}:${currentUser.id}:${orderId}`;
    if (handledInvoiceKeyRef.current === handleKey) return;

    if (!orderId) {
      handledInvoiceKeyRef.current = handleKey;
      removeInvoiceParamFromUrl();
      setPendingInvoice({ hasParam: false, orderId: '' });
      navigateTo(expectedPath);
      showToast('فاکتور پیدا نشد', 'error');
      return;
    }

    let cancelled = false;
    setIsLoadingDeepLinkInvoice(true);

    const loadAndOpenInvoice = async () => {
      try {
        let fetchedOrder: Order | null = null;

        if (isOnlineDb && supabase) {
          const { data: ordData, error: ordErr } = await supabase
            .from('orders')
            .select('id, supermarket_id, supermarket_name, assigned_visitor_id, visitor_name, status, total_amount, order_source, order_channel, reassignment_id, loading_bill_id, invoice_revised_at, order_date, stock_deducted, discount_percent, discount_status, discount_set_by, discount_reviewed_by, discount_reviewed_at, pickup_discount_percent, founder_discount_percent, founder_campaign_no, items:order_items(id, order_id, product_id, name, price, quantity, items_per_package, unit, discount_percent, created_at)')
            .eq('id', orderId)
            .maybeSingle();

          if (!ordErr && ordData) {
            fetchedOrder = ordData as Order;
          } else if (ordErr) {
            const { data: rawOrder } = await supabase
              .from('orders')
              .select('*')
              .eq('id', orderId)
              .maybeSingle();
            if (rawOrder) {
              const { data: rawItems } = await supabase
                .from('order_items')
                .select('id, order_id, product_id, name, price, quantity, items_per_package, unit, discount_percent, created_at')
                .eq('order_id', orderId);
              fetchedOrder = {
                ...(rawOrder as Order),
                items: (rawItems || []) as Order['items'],
              };
            }
          }
        } else {
          fetchedOrder = orders.find((o) => o.id === orderId) || null;
        }

        if (cancelled) return;

        if (!fetchedOrder || !fetchedOrder.id) {
          handledInvoiceKeyRef.current = handleKey;
          removeInvoiceParamFromUrl();
          setPendingInvoice({ hasParam: false, orderId: '' });
          navigateTo(expectedPath);
          showToast('فاکتور پیدا نشد', 'error');
          return;
        }

        const isAuthorized = (() => {
          if (role === 'admin') return true;
          if (role === 'visitor') {
            const myVisitorId = currentUser.id || selectedVisitorId;
            return Boolean(
              fetchedOrder.assigned_visitor_id &&
                fetchedOrder.assigned_visitor_id !== 'direct' &&
                myVisitorId &&
                (fetchedOrder.assigned_visitor_id === currentUser.id ||
                  (selectedVisitorId && fetchedOrder.assigned_visitor_id === selectedVisitorId))
            );
          }
          if (role === 'supermarket') {
            const myStoreId = currentUser.id || selectedSupermarketId;
            return Boolean(
              fetchedOrder.supermarket_id &&
                myStoreId &&
                (fetchedOrder.supermarket_id === currentUser.id ||
                  (selectedSupermarketId && fetchedOrder.supermarket_id === selectedSupermarketId))
            );
          }
          return false;
        })();

        if (!isAuthorized) {
          handledInvoiceKeyRef.current = handleKey;
          removeInvoiceParamFromUrl();
          setPendingInvoice({ hasParam: false, orderId: '' });
          navigateTo(expectedPath);
          showToast('فاکتور پیدا نشد', 'error');
          return;
        }

        const matchedSm = supermarkets.find((s) => s.id === fetchedOrder!.supermarket_id);
        const isBulkConsumer = matchedSm?.verification_type === 'bulk_consumer';
        const normalizedOrder: Order = {
          ...fetchedOrder,
          customer_type: fetchedOrder.customer_type || (isBulkConsumer ? 'consumer' : 'store'),
          supermarket_id: fetchedOrder.supermarket_id || '',
          supermarket_name: fetchedOrder.supermarket_name || matchedSm?.name || 'فروشگاه نامشخص',
          assigned_visitor_id: fetchedOrder.assigned_visitor_id || 'direct',
          visitor_name:
            fetchedOrder.visitor_name ||
            (fetchedOrder.assigned_visitor_id && fetchedOrder.assigned_visitor_id !== 'direct'
              ? 'ویزیتور'
              : 'خرید مستقیم از پخش مرکزی'),
          order_channel: getOrderChannel(fetchedOrder),
          items: Array.isArray(fetchedOrder.items) ? fetchedOrder.items : [],
        };

        handledInvoiceKeyRef.current = handleKey;
        setDeepLinkOrder(normalizedOrder);
        removeInvoiceParamFromUrl();
        setPendingInvoice({ hasParam: false, orderId: '' });
      } catch {
        if (cancelled) return;
        handledInvoiceKeyRef.current = handleKey;
        removeInvoiceParamFromUrl();
        setPendingInvoice({ hasParam: false, orderId: '' });
        navigateTo(expectedPath);
        showToast('فاکتور پیدا نشد', 'error');
      } finally {
        if (!cancelled) {
          setIsLoadingDeepLinkInvoice(false);
        }
      }
    };

    loadAndOpenInvoice();

    return () => {
      cancelled = true;
    };
  }, [
    pendingInvoice,
    authReady,
    isLoggedIn,
    justLoggedIn,
    isOnlineDb,
    isDataReady,
    fetchError,
    role,
    currentUser.id,
    selectedVisitorId,
    selectedSupermarketId,
    supermarkets,
    orders,
    expectedPath,
    navigateTo,
    showToast,
  ]);

  const [authDelayWarning, setAuthDelayWarning] = useState(false);

  useEffect(() => {
    if (authReady) return;
    const timer = setTimeout(() => {
      setAuthDelayWarning(true);
    }, 5000);
    return () => clearTimeout(timer);
  }, [authReady]);

  // 1. Initial Startup Splash Screen (shown until authReady is true)
  if (!authReady) {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center p-4 transition-colors duration-200 ${
        theme === 'light' ? 'bg-slate-100 text-slate-900' : 'bg-slate-950 text-slate-100'
      }`}>
        <div className="flex flex-col items-center gap-4 animate-in fade-in duration-300 max-w-sm text-center">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden shadow-xl border border-slate-700/40 bg-slate-900 flex items-center justify-center p-2">
            <img src={currentLogo} alt="بارفروش" className="w-full h-full object-contain" />
          </div>
          <div className="flex items-center gap-2">
            <Loader2 className={`w-5 h-5 animate-spin ${theme === 'light' ? 'text-blue-600' : 'text-blue-400'}`} />
            <span className="text-xs font-semibold opacity-80">در حال راه‌اندازی سامانه...</span>
          </div>

          {authDelayWarning && (
            <div className="flex flex-col items-center gap-2 mt-2 px-3 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-300 text-xs animate-in fade-in duration-200">
              <span className="leading-relaxed">
                ارتباط با سرور به دلیل اختلال اینترنت با تأخیر مواجه شده است.
              </span>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="mt-1 px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-sm active:scale-95"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>بارگذاری مجدد</span>
              </button>
            </div>
          )}
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

      {/* Deep-linked Invoice Loading Overlay */}
      {isLoadingDeepLinkInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl px-5 py-4 flex items-center gap-3 shadow-2xl text-slate-100">
            <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
            <span className="text-xs font-bold">در حال دریافت فاکتور...</span>
          </div>
        </div>
      )}

      {/* Deep-linked Invoice Modal */}
      <Suspense fallback={null}>
        <OrderInvoiceModal
          isOpen={Boolean(deepLinkOrder)}
          onClose={() => setDeepLinkOrder(null)}
          order={deepLinkOrder}
          supermarket={
            deepLinkOrder
              ? supermarkets.find((s) => s.id === deepLinkOrder.supermarket_id) || null
              : null
          }
          visitor={
            deepLinkOrder
              ? visitors.find((v) => v.id === deepLinkOrder.assigned_visitor_id) || null
              : null
          }
        />
      </Suspense>

      {/* Mandatory password change for Excel-imported store accounts */}
      <ForcePasswordChangeModal isOpen={isLoggedIn && mustChangePassword} />
    </div>
  );
};
