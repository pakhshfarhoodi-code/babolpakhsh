import React from 'react';
import { LoadingBillItem } from '../../types';
import { formatPrice } from './helpers';
import { ShoppingBag, Edit2, Trash2 } from 'lucide-react';

interface AggregatedItem {
  productId: string;
  productName: string;
  pack: number;
  baseUnit: string;
  unit: string;
  totalQuantity: number;
  visitorPrice: number;
  totalAmount: number;
  manualLines: LoadingBillItem[];
  orderLinesCount: number;
}

interface InvoiceReviewStepProps {
  aggregatedItems: AggregatedItem[];
  totalQuantity: number;
  totalAmount: number;
  isReadOnly: boolean;
  onEditManualLine: (item: LoadingBillItem) => void;
  onRemoveManualLine: (id: string) => void;
}

export const InvoiceReviewStep: React.FC<InvoiceReviewStepProps> = ({
  aggregatedItems,
  totalQuantity,
  totalAmount,
  isReadOnly,
  onEditManualLine,
  onRemoveManualLine,
}) => {
  return (
    <div className="rounded-3xl bg-slate-900 border border-slate-800 p-4 sm:p-5 shadow-sm space-y-4">
      {/* Step Header */}
      <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <span className="w-6 h-6 rounded-full bg-emerald-600 text-white font-black text-xs flex items-center justify-center num-fa">
            ۲
          </span>
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-4 h-4 text-emerald-400" />
            <h3 className="text-xs sm:text-sm font-bold text-slate-100">
              فاکتور تجمیعی من
            </h3>
          </div>
        </div>

        <span className="text-xs text-slate-400">
          <strong className="num-fa text-slate-200">{aggregatedItems.length.toLocaleString('fa-IR')}</strong> ردیف کالا |{' '}
          <strong className="num-fa text-slate-200">{totalQuantity.toLocaleString('fa-IR')}</strong> واحد
        </span>
      </div>

      {aggregatedItems.length === 0 ? (
        <div className="p-8 text-center rounded-2xl bg-slate-950/60 border border-slate-800 text-slate-400 text-xs space-y-2">
          <p className="font-semibold text-slate-300">هنوز قلمی در فاکتور بار اضافه نشده است.</p>
          <p className="text-slate-500">
            از بخش مشتریان سفارش‌ها را انتخاب کنید یا از بخش اقلام مازاد کالا بیفزایید.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-800/90 bg-slate-950/70 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="bg-slate-950 border-b border-slate-800 text-slate-400 font-semibold">
                  <th className="py-3 px-3.5 w-12 text-center">ردیف</th>
                  <th className="py-3 px-3.5">شرح کالا</th>
                  <th className="py-3 px-3 w-20 text-center">تعداد کل</th>
                  <th className="py-3 px-3.5 w-32 text-left">قیمت خرید ویزیتور</th>
                  <th className="py-3 px-3.5 w-36 text-left">مبلغ کل (تومان)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {aggregatedItems.map((item, idx) => (
                  <React.Fragment key={item.productId}>
                    <tr className="hover:bg-slate-900/60 transition">
                      <td className="py-3 px-3.5 text-center text-slate-500 num-fa">
                        {(idx + 1).toLocaleString('fa-IR')}
                      </td>
                      <td className="py-3 px-3.5">
                        <div className="font-bold text-slate-100">{item.productName}</div>
                        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-400">
                          <span>واحد: {item.unit}</span>
                          {item.orderLinesCount > 0 && (
                            <span className="text-blue-400">
                              (<span className="num-fa">{item.orderLinesCount.toLocaleString('fa-IR')}</span> سفارش)
                            </span>
                          )}
                          {item.manualLines.length > 0 && (
                            <span className="text-purple-400 font-medium">
                              (<span className="num-fa">{item.manualLines.length.toLocaleString('fa-IR')}</span> قلم مازاد)
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className="font-black text-sm text-slate-100 num-fa">
                          {item.totalQuantity.toLocaleString('fa-IR')}
                        </span>
                      </td>
                      <td className="py-3 px-3.5 text-left text-slate-300 num-fa">
                        {formatPrice(item.visitorPrice)}
                      </td>
                      <td className="py-3 px-3.5 text-left font-bold text-blue-400 num-fa">
                        {formatPrice(item.totalAmount)}
                      </td>
                    </tr>

                    {/* Manual lines breakdown subrows (editable & removable) */}
                    {item.manualLines.map((ml) => (
                      <tr key={ml.id} className="bg-purple-950/15 text-[11px] border-b border-purple-900/20">
                        <td className="py-1.5 px-3.5 text-center text-purple-400">↳</td>
                        <td className="py-1.5 px-3.5 text-purple-200" colSpan={1}>
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded-md bg-purple-900/40 text-purple-300 font-bold border border-purple-700/50">
                              {ml.customer_label || 'اقلام مازاد'}
                            </span>
                            {ml.line_note && (
                              <span className="text-slate-400">توضیح: {ml.line_note}</span>
                            )}
                          </div>
                        </td>
                        <td className="py-1.5 px-3 text-center font-bold text-purple-300 num-fa">
                          {ml.quantity.toLocaleString('fa-IR')} {item.unit}
                        </td>
                        <td className="py-1.5 px-3.5 text-left text-slate-400 num-fa">
                          {formatPrice((ml.visitor_price && ml.visitor_price > 1) ? ml.visitor_price : item.visitorPrice)}
                        </td>
                        <td className="py-1.5 px-3.5 text-left">
                          <div className="flex items-center justify-between">
                            <span className="text-purple-300 num-fa">
                              {formatPrice(ml.quantity * ((ml.visitor_price && ml.visitor_price > 1) ? ml.visitor_price : item.visitorPrice))}
                            </span>

                            {/* Edit & Delete actions for manual lines (only when draft) */}
                            {!isReadOnly && (
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => onEditManualLine(ml)}
                                  className="p-1 rounded hover:bg-slate-800 text-blue-400 transition cursor-pointer"
                                  title="ویرایش تعداد"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onRemoveManualLine(ml.id)}
                                  className="p-1 rounded hover:bg-slate-800 text-rose-400 transition cursor-pointer"
                                  title="حذف قلم"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-950 font-black border-t-2 border-slate-800 text-slate-100">
                  <td colSpan={2} className="py-3.5 px-3.5 text-right">
                    جمع کل فاکتور بار من:
                  </td>
                  <td className="py-3.5 px-3 text-center text-blue-400 text-sm num-fa">
                    {totalQuantity.toLocaleString('fa-IR')}
                  </td>
                  <td className="py-3.5 px-3.5"></td>
                  <td className="py-3.5 px-3.5 text-left text-base text-emerald-400 num-fa">
                    {formatPrice(totalAmount)} تومان
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
