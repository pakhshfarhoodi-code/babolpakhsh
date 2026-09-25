import React from 'react';
import { Supermarket, Visitor } from '../../types';
import { X, Store, User, MapPin, Truck, Phone } from 'lucide-react';

interface StoreProfileSheetProps {
  isOpen: boolean;
  onClose: () => void;
  store?: Supermarket;
  visitor?: Visitor;
}

export const StoreProfileSheet: React.FC<StoreProfileSheetProps> = ({
  isOpen,
  onClose,
  store,
  visitor,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-xs p-0 sm:p-4">
      {/* Backdrop click to dismiss */}
      <div className="absolute inset-0" onClick={onClose} />

      <div className="relative z-10 bg-slate-900 border border-slate-800 rounded-t-2xl sm:rounded-2xl w-full max-w-md p-4 space-y-4 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-600/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <Store className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100">{store?.name || 'فروشگاه طرف قرارداد'}</h3>
              <p className="text-xs text-slate-400">پروفایل فروشگاه و اطلاعات تماس</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Details list */}
        <div className="space-y-2.5 text-xs">
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <div className="flex items-center gap-2 text-slate-400">
              <User className="w-4 h-4 text-emerald-400" />
              <span>مدیریت / مالک:</span>
            </div>
            <span className="font-bold text-slate-200">{store?.owner || 'مدیر فروشگاه'}</span>
          </div>

          {store?.address && (
            <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-1">
              <div className="flex items-center gap-2 text-slate-400">
                <MapPin className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>آدرس فروشگاه:</span>
              </div>
              <p className="text-slate-200 text-xs leading-relaxed pr-6">{store.address}</p>
            </div>
          )}

          {visitor ? (
            <div className="p-2.5 rounded-xl bg-blue-950/40 border border-blue-900/60 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-300 font-semibold">
                  <Truck className="w-4 h-4 text-blue-400" />
                  <span>ویزیتور اختصاصی:</span>
                </div>
                <span className="font-bold text-slate-100">{visitor.name}</span>
              </div>

              {visitor.region && (
                <p className="text-xs text-slate-400 pr-6">منطقه: {visitor.region}</p>
              )}

              {visitor.phone && (
                <div className="pt-2 border-t border-blue-900/40 flex items-center justify-between">
                  <span className="text-slate-400 font-mono text-xs dir-ltr">{visitor.phone}</span>
                  <a
                    href={`tel:${visitor.phone}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-sm transition"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>تماس تلفنی</span>
                  </a>
                </div>
              )}
            </div>
          ) : (
            <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 text-slate-400">
              ویزیتور مستقیم تعیین نشده است.
            </div>
          )}
        </div>

        {/* Dismiss Button */}
        <button
          type="button"
          onClick={onClose}
          className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition cursor-pointer"
        >
          بستن
        </button>
      </div>
    </div>
  );
};
