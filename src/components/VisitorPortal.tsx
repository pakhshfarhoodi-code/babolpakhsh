import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { NewOrderModal } from './NewOrderModal';
import { SupermarketRegisterModal } from './SupermarketRegisterModal';
import { TodayTab } from './visitor/TodayTab';
import { MyLoadTab } from './visitor/MyLoadTab';
import { CustomersTab } from './visitor/CustomersTab';
import { ReportsTab } from './visitor/ReportsTab';
import { UndeliveredModal } from './visitor/UndeliveredModal';
import { DelegateModal } from './visitor/DelegateModal';
import { Order, Supermarket, Visitor } from '../types';
import {
  Truck,
  Users,
  BarChart3,
  Plus,
  ShoppingBag,
  PackagePlus,
} from 'lucide-react';

export const VisitorPortal: React.FC = () => {
  const {
    currentUser,
    selectedVisitorId,
    visitors,
    supermarkets,
    orders,
    loadingBills,
    reassignmentRequests,
    updateOrderStatus,
    requestReassignment,
    respondToReassignment,
    createLoadingBill,
    deleteOrder,
  } = useApp();

  const currentVisitor: Visitor = useMemo(() => {
    const fromList = visitors.find(
      (v) =>
        v.id === selectedVisitorId ||
        (currentUser.id && v.id === currentUser.id) ||
        (currentUser.username && v.username && v.username.toLowerCase() === currentUser.username.toLowerCase())
    );
    if (fromList) return fromList;
    return {
      id: currentUser.id || selectedVisitorId || '',
      name: currentUser.name || 'واحد ویزیت و توزیع',
      phone: currentUser.phone || '',
      region: 'منطقه توزیع',
      username: currentUser.username || 'visitor',
      is_active: true,
    };
  }, [visitors, selectedVisitorId, currentUser]);

  const visitorId = currentVisitor.id;

  // Tab State: 'today' (default) | 'load' | 'customers' | 'reports'
  const [activeTab, setActiveTab] = useState<'today' | 'load' | 'customers' | 'reports'>('today');

  // Modals state
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [isRegisterStoreModalOpen, setIsRegisterStoreModalOpen] = useState(false);
  const [selectedSupermarketForOrder, setSelectedSupermarketForOrder] = useState<string | undefined>(undefined);
  
  // Delegate & Undelivered modals
  const [selectedOrderForDelegate, setSelectedOrderForDelegate] = useState<Order | null>(null);
  const [selectedOrderForUndelivered, setSelectedOrderForUndelivered] = useState<Order | null>(null);

  // Filtered data for current visitor
  const mySupermarkets = useMemo(
    () => supermarkets.filter((s) => s.assigned_visitor_id === visitorId),
    [supermarkets, visitorId]
  );

  const myOrders = useMemo(
    () => orders.filter((o) => o.assigned_visitor_id === visitorId),
    [orders, visitorId]
  );

  // Incoming handover proposals to this visitor (or broadcast)
  const incomingHandovers = useMemo(
    () =>
      reassignmentRequests.filter(
        (r) =>
          r.status === 'pending' &&
          r.from_visitor_id !== (currentVisitor?.id || '') &&
          (!r.to_visitor_id || r.to_visitor_id === (currentVisitor?.id || ''))
      ),
    [reassignmentRequests, currentVisitor?.id]
  );

  // Outgoing handover proposals from this visitor
  const outgoingHandovers = useMemo(
    () =>
      reassignmentRequests.filter(
        (r) => r.from_visitor_id === (currentVisitor?.id || '') && r.status === 'pending'
      ),
    [reassignmentRequests, currentVisitor?.id]
  );

  const pendingDeliveryOrders = useMemo(
    () => myOrders.filter((o) => o.status === 'assigned'),
    [myOrders]
  );

  // Active loading bill for current visitor (last bill with status draft, pending, or approved)
  const currentVisitorActiveBill = useMemo(() => {
    const candidateBills = loadingBills.filter(
      (b) =>
        b.visitor_id === visitorId &&
        (b.status === 'draft' || b.status === 'pending' || b.status === 'approved')
    );
    if (candidateBills.length === 0) return null;
    return [...candidateBills].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )[0];
  }, [loadingBills, visitorId]);

  const billStatusDotColor = useMemo(() => {
    if (!currentVisitorActiveBill) return null;
    if (currentVisitorActiveBill.status === 'draft') return 'bg-amber-500';
    if (currentVisitorActiveBill.status === 'pending') return 'bg-blue-500';
    if (currentVisitorActiveBill.status === 'approved') return 'bg-emerald-500';
    return null;
  }, [currentVisitorActiveBill]);

  const billStatusTitle = useMemo(() => {
    if (!currentVisitorActiveBill) return '';
    if (currentVisitorActiveBill.status === 'draft') return 'فاکتور پیش‌نویس';
    if (currentVisitorActiveBill.status === 'pending') return 'فاکتور در انتظار تأیید ادمین';
    if (currentVisitorActiveBill.status === 'approved') return 'فاکتور تأیید شده';
    return '';
  }, [currentVisitorActiveBill]);

  // Handlers
  const handleOpenNewOrder = (supermarketId?: string) => {
    setSelectedSupermarketForOrder(supermarketId);
    setIsOrderModalOpen(true);
  };

  const handleDeliverOrder = (orderId: string) => {
    updateOrderStatus(orderId, 'delivered');
  };

  const handleConfirmUndelivered = (orderId: string, reason?: string) => {
    // Note: AppContext currently doesn't have a reason parameter in updateOrderStatus,
    // so we update status to 'undelivered' as the standard safe fallback.
    // In the summary we will explain that updateOrderStatusWithReason can be added to AppContext.
    updateOrderStatus(orderId, 'undelivered');
  };

  const handleDelegateSubmit = (orderId: string, targetVisitorId: string | null) => {
    requestReassignment(orderId, targetVisitorId);
  };

  return (
    <div className="space-y-4">
      {/* 1. Desktop & Tablet Top Navigation Tabs */}
      <div className="hidden sm:flex items-center justify-between gap-3 border-b border-slate-800 pb-2.5">
        <div className="flex items-center gap-1.5 p-1 bg-slate-900 rounded-2xl border border-slate-800/80">
          <button
            type="button"
            onClick={() => setActiveTab('today')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs transition cursor-pointer ${
              activeTab === 'today'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Truck className="w-4 h-4" />
            <span>امروز</span>
            {pendingDeliveryOrders.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-xs bg-amber-500 text-slate-950 font-black">
                {pendingDeliveryOrders.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('load')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs transition cursor-pointer relative ${
              activeTab === 'load'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <div className="relative flex items-center justify-center">
              <PackagePlus className="w-4 h-4" />
              {billStatusDotColor && (
                <span
                  title={billStatusTitle}
                  className={`absolute -top-1 -right-1 w-2 h-2 rounded-full ring-2 ring-slate-900 ${billStatusDotColor}`}
                />
              )}
            </div>
            <span>بار من</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('customers')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs transition cursor-pointer ${
              activeTab === 'customers'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>مشتریان</span>
            <span className="px-1.5 py-0.5 rounded-full text-xs bg-slate-950 text-slate-400 border border-slate-800">
              {mySupermarkets.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('reports')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs transition cursor-pointer ${
              activeTab === 'reports'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>گزارش‌ها</span>
          </button>
        </div>

        {/* Desktop "+ ثبت سفارش" Button */}
        <button
          type="button"
          onClick={() => handleOpenNewOrder()}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-95 text-white text-xs font-bold transition shadow-lg shadow-blue-600/25 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>+ ثبت سفارش جدید</span>
        </button>
      </div>

      {/* 2. Active Tab Content */}
      {activeTab === 'today' && (
        <TodayTab
          currentVisitor={currentVisitor}
          orders={myOrders}
          supermarkets={mySupermarkets}
          allSupermarkets={supermarkets}
          incomingHandovers={incomingHandovers}
          outgoingHandovers={outgoingHandovers}
          onDeliverOrder={handleDeliverOrder}
          onOpenUndeliveredModal={(order) => setSelectedOrderForUndelivered(order)}
          onOpenDelegateModal={(order) => setSelectedOrderForDelegate(order)}
          onRespondHandover={respondToReassignment}
          onOpenNewOrder={() => handleOpenNewOrder()}
          onCreateLoadingBill={createLoadingBill}
        />
      )}

      {activeTab === 'load' && (
        <MyLoadTab
          currentVisitor={currentVisitor}
          orders={myOrders}
        />
      )}

      {activeTab === 'customers' && (
        <CustomersTab
          customers={mySupermarkets}
          orders={myOrders}
          onOpenNewOrder={(customerId) => handleOpenNewOrder(customerId)}
          onOpenRegisterCustomer={() => setIsRegisterStoreModalOpen(true)}
        />
      )}

      {activeTab === 'reports' && (
        <ReportsTab
          currentVisitor={currentVisitor}
          customers={mySupermarkets}
          allSupermarkets={supermarkets}
          orders={myOrders}
          onOpenNewOrder={(customerId) => handleOpenNewOrder(customerId)}
        />
      )}

      {/* 3. Mobile Bottom Navigation Bar */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-lg border-t border-slate-800 px-3 py-1.5 shadow-2xl safe-area-bottom">
        <div className="flex items-center justify-around">
          {/* Tab 1: Today */}
          <button
            type="button"
            onClick={() => setActiveTab('today')}
            className={`flex flex-col items-center py-1 px-2.5 rounded-xl transition cursor-pointer relative ${
              activeTab === 'today' ? 'text-blue-400 font-bold' : 'text-slate-400'
            }`}
          >
            <div className="relative">
              <Truck className="w-5 h-5" />
              {pendingDeliveryOrders.length > 0 && (
                <span className="absolute -top-1.5 -right-2 w-4 h-4 rounded-full bg-amber-500 text-slate-950 text-xs font-black flex items-center justify-center">
                  {pendingDeliveryOrders.length}
                </span>
              )}
            </div>
            <span className="text-xs mt-0.5">امروز</span>
          </button>

          {/* Tab 2: Load */}
          <button
            type="button"
            onClick={() => setActiveTab('load')}
            className={`flex flex-col items-center py-1 px-2.5 rounded-xl transition cursor-pointer relative ${
              activeTab === 'load' ? 'text-blue-400 font-bold' : 'text-slate-400'
            }`}
          >
            <div className="relative">
              <PackagePlus className="w-5 h-5" />
              {billStatusDotColor && (
                <span
                  title={billStatusTitle}
                  className={`absolute -top-1 -right-1 w-2 h-2 rounded-full ring-2 ring-slate-900 ${billStatusDotColor}`}
                />
              )}
            </div>
            <span className="text-xs mt-0.5">بار من</span>
          </button>

          {/* Tab 3: Customers */}
          <button
            type="button"
            onClick={() => setActiveTab('customers')}
            className={`flex flex-col items-center py-1 px-2.5 rounded-xl transition cursor-pointer ${
              activeTab === 'customers' ? 'text-blue-400 font-bold' : 'text-slate-400'
            }`}
          >
            <Users className="w-5 h-5" />
            <span className="text-xs mt-0.5">مشتریان</span>
          </button>

          {/* Tab 4: Reports */}
          <button
            type="button"
            onClick={() => setActiveTab('reports')}
            className={`flex flex-col items-center py-1 px-2.5 rounded-xl transition cursor-pointer ${
              activeTab === 'reports' ? 'text-blue-400 font-bold' : 'text-slate-400'
            }`}
          >
            <BarChart3 className="w-5 h-5" />
            <span className="text-xs mt-0.5">گزارش‌ها</span>
          </button>
        </div>
      </div>

      {/* Undelivered Modal */}
      <UndeliveredModal
        order={selectedOrderForUndelivered}
        isOpen={Boolean(selectedOrderForUndelivered)}
        onClose={() => setSelectedOrderForUndelivered(null)}
        onConfirm={handleConfirmUndelivered}
      />

      {/* Delegate Order Modal */}
      <DelegateModal
        order={selectedOrderForDelegate}
        visitors={visitors}
        currentVisitorId={currentVisitor?.id || ''}
        isOpen={Boolean(selectedOrderForDelegate)}
        onClose={() => setSelectedOrderForDelegate(null)}
        onSubmit={handleDelegateSubmit}
      />

      {/* New Order Modal */}
      <NewOrderModal
        isOpen={isOrderModalOpen}
        onClose={() => setIsOrderModalOpen(false)}
        defaultSupermarketId={selectedSupermarketForOrder}
        defaultVisitorId={currentVisitor?.id || ''}
      />

      {/* Register Supermarket Modal */}
      <SupermarketRegisterModal
        isOpen={isRegisterStoreModalOpen}
        onClose={() => setIsRegisterStoreModalOpen(false)}
        defaultVisitorId={currentVisitor?.id || ''}
      />
    </div>
  );
};
