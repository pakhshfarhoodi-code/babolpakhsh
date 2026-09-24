// Persian date and digit helper functions for Visitor Portal

export const toEnglishDigits = (str: string): string => {
  if (!str) return '';
  return str
    .replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString())
    .replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString());
};

export interface JalaliDateParts {
  year: number;
  month: number;
  day: number;
}

export const getTodayJalali = (): JalaliDateParts => {
  try {
    const parts = new Intl.DateTimeFormat('fa-IR-u-nu-latn', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date()).split(/[\/\-]/);
    return {
      year: parseInt(parts[0], 10),
      month: parseInt(parts[1], 10),
      day: parseInt(parts[2], 10),
    };
  } catch {
    return { year: 1403, month: 7, day: 1 };
  }
};

export const parseJalaliDate = (dateStr?: string): JalaliDateParts | null => {
  if (!dateStr) return null;
  const norm = toEnglishDigits(dateStr);
  const match = norm.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (!match) return null;
  return {
    year: parseInt(match[1], 10),
    month: parseInt(match[2], 10),
    day: parseInt(match[3], 10),
  };
};

export const jalaliToDayCount = (y: number, m: number, d: number): number => {
  let days = y * 365 + Math.floor((y * 682 - 110) / 2816);
  if (m <= 6) {
    days += (m - 1) * 31;
  } else {
    days += 6 * 31 + (m - 7) * 30;
  }
  days += d;
  return days;
};

export const isToday = (dateStr?: string): boolean => {
  if (!dateStr) return false;
  const parsed = parseJalaliDate(dateStr);
  if (!parsed) return false;
  const today = getTodayJalali();
  return (
    parsed.year === today.year &&
    parsed.month === today.month &&
    parsed.day === today.day
  );
};

export const formatPrice = (price: number): string => {
  return price.toLocaleString('fa-IR');
};
