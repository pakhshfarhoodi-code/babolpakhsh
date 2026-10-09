import React, { useState, useMemo } from 'react';
import { Supermarket, Order } from '../../types';
import { useApp } from '../../context/AppContext';
import {
  Search,
  X,
  Store,
  Phone,
  MapPin,
  Plus,
  ChevronLeft,
  ShoppingBag,
  UserPlus,
  Clock,
  Navigation,
} from 'lucide-react';
import { CustomerDetailSheet } from './CustomerDetailSheet';

interface CustomersTabProps {
  customers: Supermarket[];
  orders: Order[];
  onOpenNewOrder: (customerId: string) => void;
  onOpenRegisterCustomer: () => void;
}

export const CustomersTab: React.FC<CustomersTabProps> = ({
  customers,
  orders,
  onOpenNewOrder,
  onOpenRegisterCustomer,
}) => {
  const { showToast } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomerForDetail, setSelectedCustomerForDetail] = useState<Supermarket | null>(null);

  // Filtered customers
  const filteredCustomers = useMemo(() => {
    if (!searchTerm.trim()) return customers;
    const term = searchTerm.trim().toLowerCase();
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(term) ||
        c.owner.toLowerCase().includes(term) ||
        c.phone.includes(term) ||
        c.address.toLowerCase().includes(term)
    );
  }, [customers, searchTerm]);

  return (
    <div className="space-y-4 pb-20 sm:pb-8">
      {/* Top Action Bar: Search Input & Add New Customer Button */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
        {/* Search with Clear Button */}
        <div className="relative flex-1">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="جستجوی مشتری بر اساس نام، مالک، آدرس یا تلفن..."
            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 pr-9 pl-8 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition shadow-sm"
          />
          <Search className="w-4 h-4 text-slate-500 absolute right-3 top-3 pointer-events-none" />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute left-2.5 top-2.5 p-0.5 text-slate-400 hover:text-slate-200 rounded-full hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Add Customer Button */}
        <button
          type="button"
          onClick={onOpenRegisterCustomer}
          className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-98 text-white font-bold text-xs transition shadow-md shadow-blue-600/25 cursor-pointer shrink-0"
        >
          <UserPlus className="w-4 h-4" />
          <span>+ ثبت مشتری جدید</span>
        </button>
      </div>

      {/* Customer Count Header */}
      <div className="flex items-center justify-between text-xs text-slate-400 px-1">
        <span>فهرست فروشگاه‌های تحت پوشش</span>
        <span>{filteredCustomers.length} فروشگاه</span>
      </div>

      {/* Customer Cards List */}
      {filteredCustomers.length === 0 ? (
        <div className="py-12 px-4 text-center rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
          <Store className="w-10 h-10 text-slate-600 mx-auto" />
          <p className="text-xs text-slate-400">مشتری با این مشخصات یافت نشد.</p>
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="text-xs text-blue-400 hover:underline cursor-pointer"
            >
              پاک‌کردن فیلتر جستجو
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredCustomers.map((shop) => (
            <div
              key={shop.id}
              onClick={() => setSelectedCustomerForDetail(shop)}
              className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition cursor-pointer shadow-sm relative group flex flex-col justify-between"
            >
              {/* Card Header */}
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-blue-600/15 border border-blue-500/25 flex items-center justify-center text-blue-400 shrink-0">
                      <Store className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-sm text-slate-100 truncate group-hover:text-blue-300 transition">
                          {shop.name}
                        </h3>
                        {shop.approval_status === 'pending' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                            <Clock className="w-3 h-3 text-amber-400" />
                            <span>در انتظار تایید ادمین</span>
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">مدیریت: {shop.owner}</p>
                    </div>
                  </div>

                  <span className="p-1 text-slate-500 group-hover:text-slate-300 transition">
                    <ChevronLeft className="w-4 h-4" />
                  </span>
                </div>

                {/* Address Line & Location Badge */}
                <div className="flex items-center justify-between gap-2 mt-2.5 text-xs text-slate-400 min-w-0 flex-wrap">
                  <div className="flex items-start gap-1.5 min-w-0 flex-1">
                    <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span className="truncate">{shop.address}</span>
                  </div>
                  {typeof shop.latitude === 'number' && typeof shop.longitude === 'number' ? (
                    <a
                      href={`https://www.google.com/maps?q=${shop.latitude},${shop.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 shrink-0 transition"
                      title="مسیریابی روی نقشه"
                    >
                      <Navigation className="w-3 h-3" />
                      <span>مسیریابی روی نقشه</span>
                    </a>
                  ) : (
                    <span className="text-[10px] text-slate-500 shrink-0">بدون لوکیشن نقشه</span>
                  )}
                </div>
              </div>

              {/* Card Bottom Actions */}
              <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between gap-2">
                {/* Fast Tel: Link */}
                <a
                  href={`tel:${shop.phone}`}
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-blue-400 hover:bg-slate-800 text-xs font-mono transition cursor-pointer dir-ltr"
                  title="تماس مستقیم با فروشگاه"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>{shop.phone}</span>
                </a>

                {/* Fast New Order Button (Not disabled, intercepts pending with 5-second toast) */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (shop.approval_status === 'pending') {
                      showToast('حساب این مشتری هنوز توسط ادمین تایید نشده است.', 'warning', 5000);
                      return;
                    }
                    onOpenNewOrder(shop.id);
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-bold text-xs transition shadow-md shadow-blue-600/20 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>ثبت سفارش</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Customer Detail Sheet */}
      <CustomerDetailSheet
        customer={selectedCustomerForDetail}
        orders={orders}
        isOpen={Boolean(selectedCustomerForDetail)}
        onClose={() => setSelectedCustomerForDetail(null)}
        onNewOrder={(customerId) => {
          setSelectedCustomerForDetail(null);
          onOpenNewOrder(customerId);
        }}
      />
    </div>
  );
};
