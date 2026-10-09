import React, { useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { useApp } from '../../context/AppContext';
import {
  Settings,
  Warehouse,
  Percent,
  X,
  ShieldCheck,
  ToggleLeft,
  ToggleRight,
  Info,
  Loader2,
} from 'lucide-react';

interface AdminSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AdminSettingsModal: React.FC<AdminSettingsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const {
    currentUser,
    showToast,
    refreshData,
    invoiceSettings,
    updateInvoiceSettings,
  } = useApp();

  const [requireWarehouseStep, setRequireWarehouseStep] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isSavingDiscount, setIsSavingDiscount] = useState<boolean>(false);

  const isPickupGloballyEnabled = invoiceSettings?.pickup_discount_enabled !== false;
  const pickupPercent = invoiceSettings?.pickup_discount_percent ?? 3;

  // Fetch warehouse step setting on open
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    const fetchSetting = async () => {
      setIsLoading(true);
      try {
        if (isSupabaseConfigured && supabase) {
          // 1. Try RPC get_warehouse_step_setting
          const { data, error } = await supabase.rpc('get_warehouse_step_setting');
          if (!error && data && typeof (data as any).require_warehouse_step === 'boolean') {
            if (isMounted) setRequireWarehouseStep((data as any).require_warehouse_step);
            return;
          }

          // 2. Direct query from app_settings table
          const res = await supabase
            .from('app_settings')
            .select('value')
            .eq('key', 'require_warehouse_step')
            .maybeSingle();

          if (!res.error && res.data) {
            const val = res.data.value;
            const boolVal = val === true || val === 'true' || JSON.stringify(val) === 'true';
            if (isMounted) setRequireWarehouseStep(boolVal);
          }
        } else {
          // LocalStorage fallback
          const localVal = localStorage.getItem('app_setting_require_warehouse_step');
          if (isMounted && localVal !== null) {
            setRequireWarehouseStep(localVal === 'true');
          }
        }
      } catch (err) {
        console.error('Error fetching warehouse step setting:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchSetting();
    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  const handleToggleWarehouse = async (newVal: boolean) => {
    setIsSaving(true);
    try {
      if (isSupabaseConfigured && supabase) {
        // 1. Try RPC set_warehouse_step_setting
        let res = await supabase.rpc('set_warehouse_step_setting', {
          p_enabled: newVal,
          p_actor: currentUser.name || 'ادمین',
        });

        // If RPC not present, fallback to direct app_settings upsert & audit log
        if (res.error) {
          await supabase.from('app_settings').upsert({
            key: 'require_warehouse_step',
            value: newVal,
          });

          await supabase.from('invoice_audit').insert({
            invoice_id: null,
            action: 'change_setting_require_warehouse_step',
            actor_name: currentUser.name || 'ادمین',
            details: { require_warehouse_step: newVal },
            created_at: new Date().toISOString(),
          });
        }
      } else {
        localStorage.setItem('app_setting_require_warehouse_step', String(newVal));
      }

      setRequireWarehouseStep(newVal);
      showToast(
        newVal
          ? 'مرحله تایید خروج فیزیکی انبار فعال شد.'
          : 'مرحله تایید انبار غیرفعال شد (فاکتورها بلافاصله پس از تایید ادمین ترخیص می‌شوند).',
        'success'
      );
      refreshData();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'خطا در ذخیره تنظیمات.';
      showToast(msg, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTogglePickupDiscount = async (newVal: boolean) => {
    setIsSavingDiscount(true);
    try {
      const updated = {
        ...invoiceSettings,
        pickup_discount_enabled: newVal,
      };
      const res = await updateInvoiceSettings(updated);
      if (res.success) {
        showToast(
          newVal
            ? `تخفیف تحویل درب انبار (${pickupPercent}٪) برای کل سامانه فعال شد.`
            : 'تخفیف تحویل درب انبار برای کل سامانه غیرفعال گردید.',
          'success'
        );
      } else {
        showToast(res.message || 'خطا در ذخیره تنظیمات تخفیف', 'error');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'خطا در به‌روزرسانی تخفیف';
      showToast(msg, 'error');
    } finally {
      setIsSavingDiscount(false);
    }
  };

  const handleUpdatePickupPercent = async (newPercent: number) => {
    if (newPercent < 0 || newPercent > 100) return;
    setIsSavingDiscount(true);
    try {
      const updated = {
        ...invoiceSettings,
        pickup_discount_percent: newPercent,
      };
      const res = await updateInvoiceSettings(updated);
      if (res.success) {
        showToast(`درصد تخفیف تحویل انبار به ${newPercent}٪ تغییر یافت.`, 'success');
      } else {
        showToast(res.message || 'خطا در به‌روزرسانی درصد تخفیف', 'error');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'خطا در به‌روزرسانی درصد تخفیف';
      showToast(msg, 'error');
    } finally {
      setIsSavingDiscount(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm"
      onClick={onClose}
      dir="rtl"
    >
      <div
        className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-2xl text-xs space-y-5 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
              <Settings className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base text-slate-100">
                تنظیمات کلی سامانه
              </h3>
              <p className="text-slate-400 text-[11px] mt-0.5">
                تخفیف‌های سراسری، فرآیند انبار و مراحل صدور فاکتور
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 1. Global Store 3% Pickup Discount Setting */}
        <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Percent className="w-4 h-4 text-amber-400" />
                <h4 className="font-bold text-sm text-slate-100">
                  تخفیف تحویل سفارش درب انبار (سراسری)
                </h4>
              </div>
              <p className="text-slate-400 leading-relaxed text-xs">
                امکان فعال‌سازی یا غیرفعال‌سازی قابلیت تخفیف تحویل درب انبار برای تمام فروشگاه‌ها در کل سیستم.
              </p>
            </div>

            {/* Interactive Switch */}
            <button
              type="button"
              disabled={isSavingDiscount}
              onClick={() => handleTogglePickupDiscount(!isPickupGloballyEnabled)}
              className={`p-1 rounded-full transition-colors cursor-pointer shrink-0 disabled:opacity-50 ${
                isPickupGloballyEnabled ? 'text-emerald-400' : 'text-slate-600'
              }`}
              title={isPickupGloballyEnabled ? 'کلیک جهت غیرفعال‌سازی در کل سامانه' : 'کلیک جهت فعال‌سازی در کل سامانه'}
            >
              {isSavingDiscount ? (
                <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
              ) : isPickupGloballyEnabled ? (
                <ToggleRight className="w-10 h-10" />
              ) : (
                <ToggleLeft className="w-10 h-10" />
              )}
            </button>
          </div>

          {/* Discount Percentage Config */}
          {isPickupGloballyEnabled && (
            <div className="pt-2 border-t border-slate-850 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <label className="text-slate-300 font-bold text-xs">
                  درصد تخفیف پیش‌فرض:
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.5}
                    defaultValue={pickupPercent}
                    onBlur={(e) => {
                      const val = parseFloat(e.target.value);
                      if (!isNaN(val) && val >= 0 && val <= 100 && val !== pickupPercent) {
                        handleUpdatePickupPercent(val);
                      }
                    }}
                    className="w-16 px-2 py-1 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 text-xs font-bold text-center font-mono focus:border-amber-500 focus:outline-none"
                    title="برای ذخیره پس از تغییر مقدار، خارج از کادر کلیک نمایید"
                  />
                  <span className="text-xs text-amber-300 font-mono font-bold">٪</span>
                </div>
              </div>
              <span className="text-[11px] text-emerald-400 bg-emerald-950/60 border border-emerald-800/50 px-2 py-0.5 rounded-md font-semibold">
                فعال در پنل فروشگاه‌ها ({pickupPercent}٪)
              </span>
            </div>
          )}

          {/* Explanation Banner */}
          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800/80 text-xs space-y-2">
            <div className="flex items-center gap-1.5 text-slate-300 font-semibold">
              <Info className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              <span>نحوه عملکرد در سامانه:</span>
            </div>
            {isPickupGloballyEnabled ? (
              <p className="text-slate-300 leading-relaxed text-[11px]">
                <strong className="text-emerald-400">وضعیت روشن: </strong>
                سوپرمارکت‌ها در هنگام ثبت سفارش می‌توانند کلید دریافت تخفیف درب انبار ({pickupPercent}٪) را انتخاب کنند و تخفیف به‌طور خودکار در فاکتور نهایی اعمال خواهد شد.
              </p>
            ) : (
              <p className="text-slate-300 leading-relaxed text-[11px]">
                <strong className="text-rose-400">وضعیت خاموش: </strong>
                این گزینه به‌طور کلی از پنل تمام سوپرمارکت‌ها مخفی شده و هیچ فروشگاهی امکان اعمال این تخفیف را نخواهد داشت.
              </p>
            )}
          </div>
        </div>

        {/* 2. Warehouse Step Setting Card */}
        <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Warehouse className="w-4 h-4 text-indigo-400" />
                <h4 className="font-bold text-sm text-slate-100">
                  مرحله تایید خروج فیزیکی انبار (سردخانه)
                </h4>
              </div>
              <p className="text-slate-400 leading-relaxed text-xs">
                کنترل مرحله نهایی ترخیص کالا از سردخانه و کسر موجودی فیزیکی انبار.
              </p>
            </div>

            {/* Interactive Switch */}
            <button
              type="button"
              disabled={isLoading || isSaving}
              onClick={() => handleToggleWarehouse(!requireWarehouseStep)}
              className={`p-1 rounded-full transition-colors cursor-pointer shrink-0 disabled:opacity-50 ${
                requireWarehouseStep ? 'text-indigo-400' : 'text-slate-600'
              }`}
              title={requireWarehouseStep ? 'کلیک جهت غیرفعال‌سازی' : 'کلیک جهت فعال‌سازی'}
            >
              {requireWarehouseStep ? (
                <ToggleRight className="w-10 h-10" />
              ) : (
                <ToggleLeft className="w-10 h-10" />
              )}
            </button>
          </div>

          {/* Explanation Banner */}
          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800/80 text-xs space-y-2">
            <div className="flex items-center gap-1.5 text-slate-300 font-semibold">
              <Info className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              <span>نحوه عملکرد این تنظیم:</span>
            </div>
            {requireWarehouseStep ? (
              <p className="text-slate-300 leading-relaxed text-[11px]">
                <strong className="text-indigo-300">وضعیت فعال: </strong>
                وقتی ادمین فاکتور را تایید می‌کند، وضعیت آن به <span className="font-mono text-blue-400">approved</span> تغییر یافته و کسر قطعی موجودی تنها پس از تایید خروج انبار انجام می‌شود.
              </p>
            ) : (
              <p className="text-slate-300 leading-relaxed text-[11px]">
                <strong className="text-amber-300">وضعیت غیرفعال: </strong>
                با تایید فاکتور توسط ادمین، کسر موجودی انبار به‌صورت خودکار و مستقیم انجام می‌پذیرد.
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-800">
          <div className="flex items-center gap-1.5 text-slate-500 text-[11px]">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>تنظیمات بلافاصله در کل سامانه و پایگاه داده اعمال می‌گردند.</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold transition cursor-pointer"
          >
            بستن
          </button>
        </div>
      </div>
    </div>
  );
};
