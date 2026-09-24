import React, { useState, useEffect } from 'react';
import { Plus, Minus } from 'lucide-react';
import { normalizeDigits, clampQuantity } from './shopUtils';

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
  const [inputValue, setInputValue] = useState<string>(quantity > 0 ? quantity.toString() : '');

  useEffect(() => {
    setInputValue(quantity > 0 ? quantity.toString() : '');
  }, [quantity]);

  const handleIncrement = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled || available <= 0) return;
    const target = quantity + 1;
    const { quantity: nextQty, clamped } = clampQuantity(target, available);
    if (clamped && target > available) {
      if (onExceedLimit) onExceedLimit(available);
    }
    onChange(nextQty);
  };

  const handleDecrement = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled) return;
    const target = Math.max(0, quantity - 1);
    onChange(target);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setInputValue(raw);

    const parsed = normalizeDigits(raw);
    const { quantity: nextQty, clamped } = clampQuantity(parsed, available);
    if (clamped && parsed > available) {
      if (onExceedLimit) onExceedLimit(available);
    }
    onChange(nextQty);
  };

  const handleBlur = () => {
    if (quantity === 0) {
      setInputValue('');
    } else {
      setInputValue(quantity.toString());
    }
  };

  if (disabled || available <= 0) {
    return (
      <button
        type="button"
        disabled
        className="h-10 min-w-[40px] px-3 rounded-xl bg-slate-800/50 text-slate-500 text-xs font-semibold cursor-not-allowed border border-slate-800"
      >
        ناموجود
      </button>
    );
  }

  // Initial zero state: "+ افزودن" button with at least 40x40px touch target
  if (quantity <= 0) {
    return (
      <button
        type="button"
        onClick={handleIncrement}
        className="h-10 min-w-[76px] px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm cursor-pointer shrink-0"
      >
        <Plus className="w-4 h-4" />
        <span>افزودن</span>
      </button>
    );
  }

  // Stepper mode: [ - ] [ input ] [ + ]
  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className={`inline-flex items-center rounded-xl bg-slate-900 border border-emerald-500/40 p-0.5 shadow-sm shrink-0 ${
        compact ? 'h-9' : 'h-10'
      }`}
    >
      {/* Decrement Button */}
      <button
        type="button"
        onClick={handleDecrement}
        title="کاهش تعداد"
        className="w-10 h-full rounded-lg flex items-center justify-center text-slate-200 hover:bg-slate-800 hover:text-white active:scale-90 transition cursor-pointer shrink-0"
      >
        <Minus className="w-4 h-4 text-emerald-400" />
      </button>

      {/* Editable Number Input */}
      <input
        type="text"
        inputMode="numeric"
        value={inputValue}
        onChange={handleInputChange}
        onBlur={handleBlur}
        className="w-10 sm:w-12 h-full text-center bg-transparent text-sm font-bold text-slate-100 focus:outline-none focus:bg-slate-800/80 rounded"
      />

      {/* Increment Button */}
      <button
        type="button"
        onClick={handleIncrement}
        disabled={quantity >= available}
        title="افزایش تعداد"
        className={`w-10 h-full rounded-lg flex items-center justify-center transition shrink-0 ${
          quantity >= available
            ? 'text-slate-600 cursor-not-allowed'
            : 'text-slate-200 hover:bg-slate-800 hover:text-white active:scale-90 cursor-pointer'
        }`}
      >
        <Plus className="w-4 h-4 text-emerald-400" />
      </button>
    </div>
  );
};
