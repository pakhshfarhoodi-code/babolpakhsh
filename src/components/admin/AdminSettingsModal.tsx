import React, { useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { useApp } from '../../context/AppContext';
import {
  Settings,
  Warehouse,
  CheckCircle2,
  X,
  AlertCircle,
  ShieldCheck,
  ToggleLeft,
  ToggleRight,
  Info,
} from 'lucide-react';

interface AdminSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AdminSettingsModal: React.FC<AdminSettingsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { currentUser, showToast, retryFetch } = useApp();
  const [requireWarehouseStep, setRequireWarehouseStep] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Fetch current setting on open
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

  const handleToggle = async (newVal: boolean) => {
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
      retryFetch();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'خطا در ذخیره تنظیمات.';
      showToast(msg, 'error');
    } finally {
      setIsSaving(false);
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
        className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-2xl text-xs space-y-5"
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
                تنظیمات فرآیند انبار و فاکتورها
              </h3>
              <p className="text-slate-400 text-[11px] mt-0.5">
                مدیریت جریان کاری و مراحل صدور تا خروج کالا
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

        {/* Setting Card */}
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
              onClick={() => handleToggle(!requireWarehouseStep)}
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
                وقتی ادمین فاکتور را تایید می‌کند، وضعیت آن به <span className="font-mono text-blue-400">approved</span> (تایید شده) تغییر یافته و قیمت‌ها قفل می‌شوند. سپس این فاکتور در پنل انباردار و همچنین صفحه ادمین قرار گرفته و کسر قطعی موجودی کالا تنها پس از کلیک روی «تایید خروج بار» انجام خواهد شد.
              </p>
            ) : (
              <p className="text-slate-300 leading-relaxed text-[11px]">
                <strong className="text-amber-300">وضعیت غیرفعال: </strong>
                با تایید فاکتور توسط ادمین، فاکتور بلافاصله به وضعیت <span className="font-mono text-emerald-400">loaded</span> (خارج‌شده) درآمده و کسر موجودی انبار به‌صورت خودکار انجام می‌پذیرد. در این حالت پنل انبار نیازی به تایید مجدد نداشته و تنها تاریخچه ترخیص‌ها را مشاهده می‌کند.
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-800">
          <div className="flex items-center gap-1.5 text-slate-500 text-[11px]">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>تغییرات به همراه نام ادمین در لاگ سوابق ثبت می‌گردد.</span>
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
