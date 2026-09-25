import React, { useState, useMemo } from 'react';
import { Visitor, Supermarket, Order } from '../../types';
import {
  Truck,
  Users,
  Store,
  Phone,
  MapPin,
  UserPlus,
  Search,
  Filter,
  ArrowRightLeft,
  X,
  UserCheck,
} from 'lucide-react';
import { SupermarketRegisterModal } from '../SupermarketRegisterModal';

interface TeamTabProps {
  visitors: Visitor[];
  supermarkets: Supermarket[];
  orders: Order[];
}

export const TeamTab: React.FC<TeamTabProps> = ({
  visitors,
  supermarkets,
  orders,
}) => {
  const [selectedVisitorFilter, setSelectedVisitorFilter] = useState<string | null>(null);
  const [storeSearchTerm, setStoreSearchTerm] = useState('');
  const [isRegisterStoreModalOpen, setIsRegisterStoreModalOpen] = useState(false);

  // Filtered supermarkets based on visitor click and search term
  const filteredSupermarkets = useMemo(() => {
    return supermarkets.filter((shop) => {
      if (selectedVisitorFilter && shop.assigned_visitor_id !== selectedVisitorFilter) {
        return false;
      }
      if (storeSearchTerm.trim()) {
        const term = storeSearchTerm.toLowerCase().trim();
        const matchName = shop.name.toLowerCase().includes(term);
        const matchOwner = shop.owner.toLowerCase().includes(term);
        const matchAddress = shop.address.toLowerCase().includes(term);
        const matchPhone = shop.phone.includes(term);
        if (!matchName && !matchOwner && !matchAddress && !matchPhone) return false;
      }
      return true;
    });
  }, [supermarkets, selectedVisitorFilter, storeSearchTerm]);

  const activeFilteredVisitor = visitors.find((v) => v.id === selectedVisitorFilter);

  return (
    <div className="space-y-6">
      {/* 2-Column Grid: Left Visitors Team, Right Supermarkets */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Visitors Column */}
        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-4 space-y-4 shadow-sm">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-blue-500/15 text-blue-400 flex items-center justify-center border border-blue-500/30">
                <Truck className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-100">تیم ویزیتورها و ناوگان مویرگی</h3>
                <p className="text-xs text-slate-400 mt-0.5">{visitors.length} ویزیتور فعال</p>
              </div>
            </div>

            {/* Add Visitor Button (Disabled as context doesn't support addVisitor yet) */}
            <button
              type="button"
              disabled
              title="تابع افزودن ویزیتور جدید در آپدیت بعدی AppContext اضافه خواهد شد"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 text-slate-400 border border-slate-700 text-xs font-medium cursor-not-allowed opacity-80"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>+ افزودن ویزیتور (به‌زودی)</span>
            </button>
          </div>

          {/* Visitor Cards */}
          <div className="space-y-3">
            {visitors.map((visitor) => {
              const assignedStores = supermarkets.filter((s) => s.assigned_visitor_id === visitor.id);
              const visitorOrders = orders.filter((o) => o.assigned_visitor_id === visitor.id);
              const isSelected = selectedVisitorFilter === visitor.id;

              return (
                <div
                  key={visitor.id}
                  className={`p-3.5 rounded-xl border transition shadow-xs ${
                    isSelected
                      ? 'bg-blue-950/40 border-blue-500/50'
                      : 'bg-slate-950 border-slate-800/80 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-100">{visitor.name}</span>
                        <span className="text-xs px-2 py-0.5 rounded-md bg-blue-900/50 text-blue-300 border border-blue-800/50">
                          {visitor.region}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1 font-mono">{visitor.phone}</p>
                    </div>

                    <div className="text-left space-y-0.5">
                      <span className="text-xs font-bold text-slate-200">
                        {assignedStores.length} فروشگاه
                      </span>
                      <p className="text-xs text-slate-400">
                        {visitorOrders.length} سفارش جاری
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-slate-900 flex items-center justify-between text-xs">
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedVisitorFilter(isSelected ? null : visitor.id)
                      }
                      className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                        isSelected
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'bg-slate-900 hover:bg-slate-800 text-blue-400 border border-slate-800'
                      }`}
                    >
                      <Store className="w-3.5 h-3.5" />
                      <span>
                        {isSelected ? 'حذف فیلتر و نمایش همه' : 'مشاهده فروشگاه‌های این ویزیتور'}
                      </span>
                    </button>

                    <button
                      type="button"
                      disabled
                      title="ویرایش ویزیتور در آپدیت بعدی فعال خواهد شد"
                      className="text-slate-500 hover:text-slate-400 cursor-not-allowed text-xs"
                    >
                      ویرایش ویزیتور
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Supermarkets Column */}
        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-4 space-y-4 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-purple-500/15 text-purple-400 flex items-center justify-center border border-purple-500/30">
                  <Store className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-100">فهرست سوپرمارکت‌های طرف قرارداد</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {filteredSupermarkets.length} از {supermarkets.length} فروشگاه
                  </p>
                </div>
              </div>

              {/* Add Store Button */}
              <button
                type="button"
                onClick={() => setIsRegisterStoreModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-95 text-white text-xs font-bold transition shadow-md shadow-blue-600/30 cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>+ ثبت فروشگاه جدید</span>
              </button>
            </div>

            {/* Filter banner if active */}
            {activeFilteredVisitor && (
              <div className="mt-3 p-2.5 rounded-xl bg-blue-950/60 border border-blue-800/60 text-xs flex items-center justify-between">
                <span className="text-blue-200">
                  در حال نمایش فروشگاه‌های ویزیتور:{' '}
                  <strong>{activeFilteredVisitor.name}</strong> ({activeFilteredVisitor.region})
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedVisitorFilter(null)}
                  className="p-1 text-slate-400 hover:text-slate-100 rounded-md cursor-pointer"
                  title="نمایش همه فروشگاه‌ها"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Store search box */}
            <div className="relative mt-3">
              <Search className="w-4 h-4 absolute right-3 top-2.5 text-slate-500 pointer-events-none" />
              <input
                type="text"
                value={storeSearchTerm}
                onChange={(e) => setStoreSearchTerm(e.target.value)}
                placeholder="جستجوی نام فروشگاه، مالک، آدرس یا تلفن..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pr-9 pl-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Supermarket Cards List */}
            <div className="space-y-3 mt-3 max-h-[500px] overflow-y-auto pr-1">
              {filteredSupermarkets.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-xs">
                  فروشگاهی مطابق با فیلتر یافت نشد.
                </div>
              ) : (
                filteredSupermarkets.map((shop) => {
                  const assignedVisitor = visitors.find((v) => v.id === shop.assigned_visitor_id);

                  return (
                    <div
                      key={shop.id}
                      className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 space-y-2 text-xs"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-bold text-sm text-slate-100">{shop.name}</p>
                          <p className="text-slate-400 mt-0.5">مدیریت: {shop.owner}</p>
                        </div>
                        <span className="px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800 text-slate-400 font-mono text-xs">
                          {shop.phone}
                        </span>
                      </div>

                      <div className="flex items-start gap-1.5 text-slate-400 pt-1">
                        <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                        <span className="truncate">{shop.address}</span>
                      </div>

                      {/* Bottom row: Assigned Visitor select + Toggle store */}
                      <div className="mt-2.5 pt-2 border-t border-slate-900 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-500">ویزیتور:</span>
                          <select
                            disabled
                            title="تغییر مستقیم ویزیتور فروشگاه نیازمند متد reassignSupermarketVisitor در کانتکست است"
                            value={shop.assigned_visitor_id}
                            className="bg-slate-900 border border-slate-800 text-slate-300 rounded-lg px-2 py-1 text-xs cursor-not-allowed opacity-80"
                          >
                            <option value={shop.assigned_visitor_id}>
                              {assignedVisitor ? `${assignedVisitor.name} (${assignedVisitor.region})` : 'تعیین نشده'}
                            </option>
                          </select>
                        </div>

                        <button
                          type="button"
                          disabled
                          title="فعال/غیرفعال‌سازی فروشگاه نیازمند متد setSupermarketActive در کانتکست است"
                          className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-xs cursor-not-allowed opacity-80"
                        >
                          فعال
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Supermarket Register Modal */}
      <SupermarketRegisterModal
        isOpen={isRegisterStoreModalOpen}
        onClose={() => setIsRegisterStoreModalOpen(false)}
      />
    </div>
  );
};
