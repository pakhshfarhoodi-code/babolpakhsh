import React from 'react';

export interface PriceProps {
  value: number | string;
  size?: 'lg' | 'md' | 'sm';
  tone?: 'success' | 'amber' | 'muted' | 'default' | 'violet';
  unit?: string;
  className?: string;
  numClassName?: string;
  unitClassName?: string;
  bold?: boolean;
}

const faNumberFormatter = new Intl.NumberFormat('fa-IR', {
  maximumFractionDigits: 3,
});

export const formatPriceNumber = (amount: number | string): string => {
  const num = typeof amount === 'number' ? (isNaN(amount) ? 0 : amount) : (Number(amount) || 0);
  return faNumberFormatter.format(num);
};

export const Price: React.FC<PriceProps> = ({
  value,
  size = 'md',
  tone = 'default',
  unit = 'تومان',
  className = '',
  numClassName = '',
  unitClassName = '',
  bold = true,
}) => {
  const num = typeof value === 'number' ? (isNaN(value) ? 0 : value) : (Number(value) || 0);
  const formattedNumber = faNumberFormatter.format(num);

  const sizeClasses = {
    lg: 'text-[14px] sm:text-[15px]',
    md: 'text-[13px]',
    sm: 'text-[11px] sm:text-[12px]',
  }[size];

  const toneClasses = {
    success: 'text-emerald-400',
    amber: 'text-amber-400 dark:text-amber-300',
    muted: 'text-slate-400',
    violet: 'text-violet-400 dark:text-violet-300',
    default: 'text-slate-100',
  }[tone];

  return (
    <span
      className={`inline-flex items-baseline whitespace-nowrap leading-none select-none ${toneClasses} ${sizeClasses} ${className}`.trim()}
    >
      <span className={`num-fa ${bold ? 'font-semibold' : 'font-normal'} ${numClassName}`.trim()}>
        {formattedNumber}
      </span>
      {unit && (
        <>
          {'\u00A0'}
          <span className={`font-normal text-[0.8em] opacity-90 ${unitClassName}`.trim()}>
            {unit}
          </span>
        </>
      )}
    </span>
  );
};
