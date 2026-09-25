import React, { useState } from 'react';
import { LoadingBill, Product } from '../../types';
import { aggregateBillItems, formatNumber } from './helpers';
import {
  FileText,
  ChevronDown,
  ChevronUp,
  User,
  Clock,
  CheckCircle2,
  Package,
} from 'lucide-react';

interface BillHistoryListProps {
  bills: LoadingBill[];
  products: Product[];
}

export const BillHistoryList: React.FC<BillHistoryListProps> = ({
  bills,
  products,
}) => {
  const [expandedBillId, setExpandedBillId] = useState<string | null>(null);

  const toggleExpand = (billId: string) => {
    setExpandedBillId((prev) => (prev === billId ? null : billId));
  };

  if (bills.length === 0) {
    return (
      <div className="py-10 text-center text-slate-500 text-xs bg-slate-900/40 rounded-xl border border-slate-800">
        هیچ سابقه‌ای از برگه‌های ترخیص شده در سیستم وجود ندارد.
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {bills.map((bill) => {
        const isExpanded = expandedBillId === bill.id;
        const aggregated = aggregateBillItems(bill, products);
        const totalItemsCount = aggregated.reduce((sum, i) => sum + i.totalQuantity, 0);

        return (
          <div
            key={bill.id}
            className="rounded-xl bg-slate-950/70 border border-slate-800 overflow-hidden transition-colors"
          >
            {/* Header Accordion Bar */}
            <div
              onClick={() => toggleExpand(bill.id)}
              className="p-3.5 flex items-center justify-between gap-3 cursor-pointer hover:bg-slate-900/60 transition select-none"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="font-mono font-bold text-xs text-emerald-400 bg-emerald-950/70 px-2 py-0.5 rounded border border-emerald-800/40 shrink-0">
                  {bill.id}
                </span>

                <div className="flex items-center gap-1.5 text-xs text-slate-200 truncate">
                  <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="text-slate-400">ویزیتور:</span>
                  <span className="font-semibold truncate">{bill.visitor_name}</span>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <div className="hidden sm:flex items-center gap-1 text-xs text-slate-400">
                  <Clock className="w-3.5 h-3.5 text-slate-500" />
                  <span>{bill.created_at}</span>
                </div>

                <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span className="hidden xs:inline">ترخیص شده</span>
                </span>

                <span className="p-1 text-slate-400 hover:text-slate-200">
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </span>
              </div>
            </div>

            {/* Accordion Content: Aggregated items list */}
            {isExpanded && (
              <div className="p-4 pt-1 border-t border-slate-800/80 bg-slate-900/40 space-y-3">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="flex items-center gap-1.5 font-medium text-slate-300">
                    <Package className="w-3.5 h-3.5 text-indigo-400" />
                    <span>ریز اقلام ترخیص‌شده به خودروی مویرگی:</span>
                  </span>
                  <span>مجموع تعداد: {formatNumber(totalItemsCount)} واحد</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {aggregated.map((it) => (
                    <div
                      key={it.productId}
                      className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between gap-2"
                    >
                      <span className="text-slate-200 font-medium truncate">
                        {it.productName}
                      </span>
                      <span className="font-bold text-emerald-400 font-mono shrink-0">
                        {formatNumber(it.totalQuantity)} {it.unit}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
