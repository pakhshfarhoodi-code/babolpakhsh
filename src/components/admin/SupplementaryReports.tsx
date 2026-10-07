import React, { useState, useMemo } from 'react';
import { LoadingBill, Visitor } from '../../types';
import { formatPrice } from './helpers';
import { getPackSize } from '../../utils/orderLine';

interface SupplementaryReportsProps {
  loadingBills: LoadingBill[];
  visitors: Visitor[];
}

export const SupplementaryReports: React.FC<SupplementaryReportsProps> = ({
  loadingBills,
  visitors,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [timeRange, setTimeRange] = useState<'all' | 'today' | '7days' | '30days'>('all');

  // Filter approved or loaded bills
  const eligibleBills = useMemo(() => {
    const now = Date.now();
    return loadingBills.filter((bill) => {
      if (bill.status !== 'approved' && bill.status !== 'loaded') {
        return false;
      }

      if (timeRange === 'all') return true;

      const billTime = Date.parse(bill.finalized_at || bill.approved_at || bill.created_at);
      if (isNaN(billTime)) return true;

      const diffDays = (now - billTime) / (1000 * 60 * 60 * 24);

      if (timeRange === 'today') {
        return diffDays < 1;
      }
      if (timeRange === '7days') {
        return diffDays <= 7;
      }
      if (timeRange === '30days') {
        return diffDays <= 30;
      }
      return true;
    });
  }, [loadingBills, timeRange]);

  // Aggregate by visitor
  const visitorRows = useMemo(() => {
    // Map of visitorId -> stats
    const map = new Map<
      string,
      {
        visitorId: string;
        visitorName: string;
        billsCount: number;
        totalVisitorCost: number;
        totalStoreAmount: number;
        rateDifference: number;
      }
    >();

    for (const bill of eligibleBills) {
      const vId = bill.visitor_id || 'unknown';
      const vName = bill.visitor_name || 'بدون ویزیتور';

      // Visitor snapshot cost: from bill.total_visitor_cost or sum of items
      const vCost =
        bill.total_visitor_cost !== undefined && bill.total_visitor_cost !== null
          ? Number(bill.total_visitor_cost)
          : (bill.items || []).reduce(
              (sum, item) => sum + (item.visitor_price || 0) * getPackSize(item.items_per_package) * item.quantity,
              0
            );

      // Store snapshot amount: from bill.total_store_amount or sum of items
      const sAmount =
        bill.total_store_amount !== undefined && bill.total_store_amount !== null
          ? Number(bill.total_store_amount)
          : (bill.items || []).reduce(
              (sum, item) => sum + (item.store_price || 0) * getPackSize(item.items_per_package) * item.quantity,
              0
            );

      const existing = map.get(vId);
      if (existing) {
        existing.billsCount += 1;
        existing.totalVisitorCost += vCost;
        existing.totalStoreAmount += sAmount;
        existing.rateDifference += (sAmount - vCost);
      } else {
        map.set(vId, {
          visitorId: vId,
          visitorName: vName,
          billsCount: 1,
          totalVisitorCost: vCost,
          totalStoreAmount: sAmount,
          rateDifference: sAmount - vCost,
        });
      }
    }

    return Array.from(map.values()).sort((a, b) => b.totalStoreAmount - a.totalStoreAmount);
  }, [eligibleBills]);

  // Grand totals
  const grandTotal = useMemo(() => {
    return visitorRows.reduce(
      (acc, row) => {
        acc.totalVisitorCost += row.totalVisitorCost;
        acc.totalStoreAmount += row.totalStoreAmount;
        acc.rateDifference += row.rateDifference;
        acc.billsCount += row.billsCount;
        return acc;
      },
      { totalVisitorCost: 0, totalStoreAmount: 0, rateDifference: 0, billsCount: 0 }
    );
  }, [visitorRows]);

  return (
    <div className="mt-8 pt-4 border-t border-slate-800/40" dir="rtl">
      {/* Neutral Accordion Trigger - Subtle, muted, without loud icons or bright colors */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full py-2.5 px-3 flex items-center justify-between rounded-xl bg-slate-900/30 hover:bg-slate-900/50 border border-slate-800/40 text-slate-500 hover:text-slate-400 text-xs transition select-none cursor-pointer"
      >
        <span className="font-normal">گزارش‌های تکمیلی</span>
        <span className="text-[11px] font-mono text-slate-600">
          {isOpen ? '▲' : '▼'}
        </span>
      </button>

      {/* Accordion Content */}
      {isOpen && (
        <div className="mt-3 p-4 rounded-xl bg-slate-900/20 border border-slate-800/40 space-y-4">
          {/* Header & Filter Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800/40">
            <h4 className="text-xs font-medium text-slate-400">
              مقایسه نرخ‌ها
            </h4>

            {/* Time range selector */}
            <div className="flex items-center gap-1.5 text-[11px]">
              <span className="text-slate-500 ml-1">بازه زمانی:</span>
              <button
                type="button"
                onClick={() => setTimeRange('all')}
                className={`px-2 py-0.5 rounded text-[11px] transition ${
                  timeRange === 'all'
                    ? 'bg-slate-800 text-slate-300'
                    : 'text-slate-500 hover:text-slate-400'
                }`}
              >
                همه
              </button>
              <button
                type="button"
                onClick={() => setTimeRange('today')}
                className={`px-2 py-0.5 rounded text-[11px] transition ${
                  timeRange === 'today'
                    ? 'bg-slate-800 text-slate-300'
                    : 'text-slate-500 hover:text-slate-400'
                }`}
              >
                امروز
              </button>
              <button
                type="button"
                onClick={() => setTimeRange('7days')}
                className={`px-2 py-0.5 rounded text-[11px] transition ${
                  timeRange === '7days'
                    ? 'bg-slate-800 text-slate-300'
                    : 'text-slate-500 hover:text-slate-400'
                }`}
              >
                ۷ روز اخیر
              </button>
              <button
                type="button"
                onClick={() => setTimeRange('30days')}
                className={`px-2 py-0.5 rounded text-[11px] transition ${
                  timeRange === '30days'
                    ? 'bg-slate-800 text-slate-300'
                    : 'text-slate-500 hover:text-slate-400'
                }`}
              >
                ۳۰ روز اخیر
              </button>
            </div>
          </div>

          {/* Simple Table */}
          {visitorRows.length === 0 ? (
            <div className="py-6 text-center text-slate-600 text-xs">
              داده‌ای در این بازه زمانی یافت نشد.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="border-b border-slate-800/60 text-slate-500 text-[11px]">
                    <th className="py-2.5 px-3 font-normal">ویزیتور</th>
                    <th className="py-2.5 px-3 font-normal text-left font-mono">جمع نرخ خرید ویزیتور</th>
                    <th className="py-2.5 px-3 font-normal text-left font-mono">جمع نرخ فروش فروشگاه</th>
                    <th className="py-2.5 px-3 font-normal text-left font-mono">اختلاف نرخ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/30 text-slate-300">
                  {visitorRows.map((row) => (
                    <tr key={row.visitorId} className="hover:bg-slate-800/20">
                      <td className="py-2.5 px-3 text-slate-300">
                        {row.visitorName}
                      </td>
                      <td className="py-2.5 px-3 text-left font-mono text-slate-400">
                        {formatPrice(row.totalVisitorCost)}
                      </td>
                      <td className="py-2.5 px-3 text-left font-mono text-slate-400">
                        {formatPrice(row.totalStoreAmount)}
                      </td>
                      <td className="py-2.5 px-3 text-left font-mono text-slate-300">
                        {formatPrice(row.rateDifference)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-slate-800/60 font-medium text-slate-300 bg-slate-900/40">
                    <td className="py-2.5 px-3 text-slate-400">
                      مجموع
                    </td>
                    <td className="py-2.5 px-3 text-left font-mono text-slate-300">
                      {formatPrice(grandTotal.totalVisitorCost)}
                    </td>
                    <td className="py-2.5 px-3 text-left font-mono text-slate-300">
                      {formatPrice(grandTotal.totalStoreAmount)}
                    </td>
                    <td className="py-2.5 px-3 text-left font-mono text-slate-200">
                      {formatPrice(grandTotal.rateDifference)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
