import React from 'react';
import { useApp } from './context/AppContext';
import { Header } from './components/Header';
import { AdminPanel } from './components/AdminPanel';
import { VisitorPortal } from './components/VisitorPortal';
import { SupermarketPortal } from './components/SupermarketPortal';
import { WarehousePanel } from './components/WarehousePanel';

export const App: React.FC = () => {
  const { role } = useApp();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-blue-600 selection:text-white">
      <Header />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6">
        {role === 'admin' && <AdminPanel />}
        {role === 'visitor' && <VisitorPortal />}
        {role === 'supermarket' && <SupermarketPortal />}
        {role === 'warehouse' && <WarehousePanel />}
      </main>

      <footer className="border-t border-slate-900 bg-slate-950/80 py-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-wrap items-center justify-between gap-2">
          <span>سامانه مدیریت سفارش و پخش مویرگی البرز — نسخه سازمانی توزیع زنجیره سرد</span>
          <span>طراحی شده بر مبنای استانداردهای انبارداری، تفکیک رزرو کالا و انتقال ویزیتور</span>
        </div>
      </footer>
    </div>
  );
};
