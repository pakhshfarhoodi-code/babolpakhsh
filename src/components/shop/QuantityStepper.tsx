import React, { useState, useEffect } from 'react';
import { Plus, Minus } from 'lucide-react';
import { normalizeDigits, clampQuantity, toPersianDigits } from './shopUtils';

interface QuantityStepperProps {
  quantity: number;
  available: number;
  onChange: (qty: number) => void;
  disabled?: boolean;
  onExceedLimit?: (maxAvailable: number) => void;
  compact?: boolean;
}

export const QuantityStepper: React.FC<QuantityStepperProps> = ({
  quantity,
  available,
  onChange,
  disabled = false,
  onExceedLimit,
  compact = false,
}) => {
  const [inputValue, setInputValue] = useState<string>(
    quantity > 0 ? toPersianDigits(quantity) : ''
  );

  useEffect(() => {
    setInputValue(quantity > 0 ? toPersianDigits(quantity) : '');
  }, [quantity]);

  const handleIncrement = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled || available <= 0) return;
    const target = Math.round((quantity + 1) * 1000) / 1000;
    const { quantity: nextQty, clamped } = clampQuantity(target, available);
    if (clamped && target > available) {
      if (onExceedLimit) onExceedLimit(available);
    }
    onChange(nextQty);
  };

  const handleDecrement = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled) return;
    const target = Math.max(0, Math.round((quantity - 1) * 1000) / 1000);
    onChange(target);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const persianRaw = toPersianDigits(raw);
    setInputValue(persianRaw);

    const parsed = normalizeDigits(raw);
    const { quantity: nextQty, clamped } = clampQuantity(parsed, available);
    if (clamped && parsed > available) {
      if (onExceedLimit) onExceedLimit(available);
    }
    onChange(nextQty);
  };

  const handleBlur = () => {
    const parsed = normalizeDigits(inputValue);
    if (parsed <= 0) {
      setInputValue('');
      onChange(0);
    } else {
      const { quantity: clampedQty } = clampQuantity(parsed, available);
      const rounded = Math.round(clampedQty * 1000) / 1000;
      setInputValue(toPersianDigits(rounded));
      onChange(rounded);
    }
  };

  if (disabled || available <= 0) {
    return (
      <button
        type="button"
        disabled
        className="h-9 w-[92px] rounded-xl bg-slate-800/50 text-slate-500 text-[11px] font-semibold cursor-not-allowed border border-slate-800 flex items-center justify-center select-none shrink-0"
      >
        ناموجود
      </button>
    );
  }

  // Initial zero state: "+ افزودن" button (h-9, w-[92px], icon + text)
  if (quantity <= 0) {
    return (
      <button
        type="button"
        onClick={handleIncrement}
        className="h-9 w-[92px] rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-xs cursor-pointer select-none shrink-0"
      >
        <Plus className="w-3.5 h-3.5 shrink-0" />
        <span>افزودن</span>
      </button>
    );
  }

  // Stepper mode: [ - (28px) ] [ input (center) ] [ + (28px) ]
  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="flex items-center w-[92px] h-9 rounded-xl bg-slate-900 border border-emerald-500/50 p-0.5 shadow-xs shrink-0"
    >
      {/* Decrement Button: 28px width (w-7) */}
      <button
        type="button"
        onClick={handleDecrement}
        title="کاهش تعداد"
        className="w-7 h-full rounded-lg flex items-center justify-center text-slate-200 hover:bg-slate-800 hover:text-white active:scale-90 transition cursor-pointer shrink-0"
      >
        <Minus className="w-3.5 h-3.5 text-emerald-400" />
      </button>

      {/* Editable Number Input with Decimal Keypad in middle */}
      <input
        type="text"
        inputMode="decimal"
        value={inputValue}
        onChange={handleInputChange}
        onBlur={handleBlur}
        placeholder="۰"
        className="flex-1 min-w-0 h-full text-center bg-transparent text-xs font-bold text-slate-100 num-fa focus:outline-none focus:bg-slate-800/80 rounded px-0.5"
      />

      {/* Increment Button: 28px width (w-7) */}
      <button
        type="button"
        onClick={handleIncrement}
        disabled={quantity >= available}
        title="افزایش تعداد"
        className={`w-7 h-full rounded-lg flex items-center justify-center transition shrink-0 ${
          quantity >= available
            ? 'text-slate-600 cursor-not-allowed'
            : 'text-slate-200 hover:bg-slate-800 hover:text-white active:scale-90 cursor-pointer'
        }`}
      >
        <Plus className="w-3.5 h-3.5 text-emerald-400" />
      </button>
    </div>
  );
};
