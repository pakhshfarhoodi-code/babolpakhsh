import React from 'react';
import { LoadingBillStatus } from '../../types';
import { formatOrderDate } from './helpers';
import {
  FileEdit,
  Clock,
  CheckCircle2,
  Truck,
  AlertCircle,
  AlertTriangle,
} from 'lucide-react';

interface InvoiceStatusStepperProps {
  status?: LoadingBillStatus;
  cancelReason?: string | null;
  submittedAt?: string | null;
  createdAt?: string;
  revisionCount?: number;
}

const STEPS: { key: LoadingBillStatus; label: string; icon: React.FC<{ className?: string }> }[] = [
  { key: 'draft', label: 'پیش‌نویس', icon: FileEdit },
  { key: 'pending', label: 'در انتظار ادمین', icon: Clock },
  { key: 'approved', label: 'تایید شده', icon: CheckCircle2 },
  { key: 'loaded', label: 'بارگیری شده', icon: Truck },
];

export const InvoiceStatusStepper: React.FC<InvoiceStatusStepperProps> = ({
  status = 'draft',
  cancelReason,
  submittedAt,
  createdAt,
  revisionCount = 0,
}) => {
  const isCancelled = status === 'cancelled';

  // Determine numeric step index (0 to 3)
  const currentStepIndex = (() => {
    switch (status) {
      case 'draft':
        return 0;
      case 'pending':
        return 1;
      case 'approved':
        return 2;
      case 'loaded':
        return 3;
      default:
        return 0;
    }
  })();

  return (
    <div className="space-y-2.5">
      {/* 4-Chip Progress Stepper */}
      <div className="p-2 sm:p-2.5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xs">
        <div className="flex items-center justify-between gap-1 sm:gap-2 overflow-x-auto text-xs">
          {STEPS.map((step, idx) => {
            const Icon = step.icon;
            const isCompleted = !isCancelled && currentStepIndex > idx;
            const isCurrent = !isCancelled && currentStepIndex === idx;

            let chipClasses = 'bg-slate-950/60 border-slate-800 text-slate-500';
            let iconClasses = 'text-slate-600';

            if (isCurrent) {
              if (step.key === 'draft') {
                chipClasses = 'bg-blue-600/15 border-blue-500/40 text-blue-300 font-bold shadow-xs';
                iconClasses = 'text-blue-400';
              } else if (step.key === 'pending') {
                chipClasses = 'bg-amber-500/15 border-amber-500/40 text-amber-300 font-bold shadow-xs animate-pulse';
                iconClasses = 'text-amber-400';
              } else if (step.key === 'approved') {
                chipClasses = 'bg-blue-600/20 border-blue-400/50 text-blue-200 font-bold shadow-xs';
                iconClasses = 'text-blue-300';
              } else if (step.key === 'loaded') {
                chipClasses = 'bg-emerald-600/20 border-emerald-500/40 text-emerald-200 font-bold shadow-xs';
                iconClasses = 'text-emerald-400';
              }
            } else if (isCompleted) {
              chipClasses = 'bg-emerald-950/40 border-emerald-800/40 text-emerald-400 font-medium';
              iconClasses = 'text-emerald-400';
            }

            return (
              <React.Fragment key={step.key}>
                <div
                  className={`flex-1 min-w-[70px] sm:min-w-0 py-1.5 px-2 rounded-xl border flex items-center justify-center gap-1.5 text-[11px] sm:text-xs transition ${chipClasses}`}
                >
                  <Icon className={`w-3.5 h-3.5 shrink-0 ${iconClasses}`} />
                  <span className="truncate">{step.label}</span>
                </div>
                {idx < STEPS.length - 1 && (
                  <span className="text-slate-700 text-xs shrink-0 select-none">←</span>
                )}
              </React.Fragment>
            );
          })}

          {/* Cancelled Chip if status === 'cancelled' */}
          {isCancelled && (
            <div className="py-1.5 px-2.5 rounded-xl border bg-rose-950/60 border-rose-600/40 text-rose-300 font-bold flex items-center gap-1.5 text-[11px] sm:text-xs shrink-0">
              <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              <span>لغو شده</span>
            </div>
          )}
        </div>
      </div>

      {/* Revision Notice */}
      {revisionCount > 0 && (
        <div className="px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-300 text-xs flex items-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span>
            این فاکتور بار توسط ادمین اصلاح شده است (<strong className="num-fa">{revisionCount.toLocaleString('fa-IR')}</strong> بار)
          </span>
        </div>
      )}

      {/* Cancelled Reason Banner */}
      {isCancelled && (
        <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs space-y-1">
          <div className="flex items-center gap-2 font-bold text-rose-400">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>این فاکتور بار توسط ادمین یا سیستم لغو شده است:</span>
          </div>
          <p className="mr-6 text-slate-200">
            {cancelReason || 'دلیلی قید نشده است.'}
          </p>
        </div>
      )}

      {/* Pending Waiting Notice */}
      {status === 'pending' && (
        <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-400 shrink-0 animate-pulse" />
            <span>فاکتور به انبار ارسال شده و در انتظار بررسی و تایید ادمین است.</span>
          </div>
          {(submittedAt || createdAt) && (
            <span className="text-[11px] text-amber-400/80">
              تاریخ ارسال: {formatOrderDate(submittedAt || createdAt)}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
