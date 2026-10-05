/**
 * Date and Time Utilities for Persian (Solar Hijri) Calendar & Iran Timezone (Asia/Tehran)
 * 
 * Ensures all orders, invoices, and reports are formatted in Persian calendar and Persian digits (۰۱۲۳۴۵۶۷۸۹).
 * Strictly anchors all calculations to the 'Asia/Tehran' timezone (UTC+3:30) so orders placed
 * late at night or early morning (e.g. 1:00 AM) are always recorded and displayed on the exact
 * Iranian calendar day without timezone offset glitches.
 */

export const TEHRAN_TIMEZONE = 'Asia/Tehran';

/**
 * Converts English digits to Persian digits
 */
export function toPersianDigits(input: string | number | null | undefined): string {
  if (input === null || input === undefined || input === '') return '';
  return input
    .toString()
    .replace(/[0-9]/g, (d) => ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'][parseInt(d, 10)]);
}

/**
 * Converts Persian/Arabic digits to English digits
 */
export function toEnglishDigits(str: string | null | undefined): string {
  if (!str) return '';
  return str
    .replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString())
    .replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString());
}

export interface JalaliDateParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

/**
 * Parses any date (ISO timestamp, UTC string, Date object) in the Asia/Tehran timezone
 * and returns its Solar Hijri (Jalali) components.
 */
export function getTehranDateParts(dateInput?: string | number | Date | null): JalaliDateParts | null {
  if (!dateInput) return null;

  try {
    let dateObj: Date;

    if (dateInput instanceof Date) {
      dateObj = dateInput;
    } else if (typeof dateInput === 'number') {
      dateObj = new Date(dateInput);
    } else {
      const trimmed = dateInput.trim();
      // If it's already an ISO or Gregorian date string
      if (trimmed.includes('T') || trimmed.includes('-') || trimmed.includes(':') || trimmed.startsWith('20')) {
        dateObj = new Date(trimmed);
      } else {
        // Fallback: test if it's already a Jalali string like 1403/07/12
        const norm = toEnglishDigits(trimmed);
        const match = norm.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})(?:\s+(\d{1,2}):(\d{1,2}))?/);
        if (match) {
          return {
            year: parseInt(match[1], 10),
            month: parseInt(match[2], 10),
            day: parseInt(match[3], 10),
            hour: match[4] ? parseInt(match[4], 10) : 0,
            minute: match[5] ? parseInt(match[5], 10) : 0,
          };
        }
        dateObj = new Date(trimmed);
      }
    }

    if (isNaN(dateObj.getTime())) return null;

    // Use Intl with Asia/Tehran timezone and Latin numerals for clean parsing
    const formatter = new Intl.DateTimeFormat('fa-IR-u-nu-latn', {
      timeZone: TEHRAN_TIMEZONE,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      hour12: false,
    });

    const parts = formatter.formatToParts(dateObj);
    let year = 1403;
    let month = 1;
    let day = 1;
    let hour = 0;
    let minute = 0;

    for (const part of parts) {
      if (part.type === 'year') year = parseInt(part.value, 10);
      if (part.type === 'month') month = parseInt(part.value, 10);
      if (part.type === 'day') day = parseInt(part.value, 10);
      if (part.type === 'hour') hour = parseInt(part.value, 10);
      if (part.type === 'minute') minute = parseInt(part.value, 10);
    }

    return { year, month, day, hour, minute };
  } catch (err) {
    console.warn('Error parsing Tehran date parts:', err);
    return null;
  }
}

/**
 * Returns today's date in Iran (Asia/Tehran)
 */
export function getTodayJalali(): { year: number; month: number; day: number } {
  const parts = getTehranDateParts(new Date());
  if (parts) {
    return { year: parts.year, month: parts.month, day: parts.day };
  }
  return { year: 1403, month: 7, day: 1 };
}

/**
 * Converts a Jalali year, month, day into day count for date math
 */
export function jalaliToDayCount(y: number, m: number, d: number): number {
  let days = y * 365 + Math.floor((y * 682 - 110) / 2816);
  if (m <= 6) {
    days += (m - 1) * 31;
  } else {
    days += 6 * 31 + (m - 7) * 30;
  }
  days += d;
  return days;
}

/**
 * Checks if a given timestamp represents "Today" in Iran (Asia/Tehran).
 * Correctly accounts for late-night / 1 AM orders.
 */
export function isTodayInTehran(dateInput?: string | number | Date | null): boolean {
  if (!dateInput) return false;
  const parts = getTehranDateParts(dateInput);
  if (!parts) return false;
  const today = getTodayJalali();
  return (
    parts.year === today.year &&
    parts.month === today.month &&
    parts.day === today.day
  );
}

/**
 * Checks if a given date is within the last N days in Iran.
 */
export function isWithinDaysInTehran(dateInput: string | number | Date | null | undefined, daysLimit: number): boolean {
  if (!dateInput) return false;
  const parts = getTehranDateParts(dateInput);
  if (!parts) return false;
  const today = getTodayJalali();
  const orderDays = jalaliToDayCount(parts.year, parts.month, parts.day);
  const todayDays = jalaliToDayCount(today.year, today.month, today.day);
  const diff = todayDays - orderDays;
  return diff >= 0 && diff <= daysLimit;
}

export interface FormatPersianDateOptions {
  includeTime?: boolean;
  timeOnly?: boolean;
  separator?: string;
}

/**
 * Formats any date / ISO timestamp into full Persian Solar Hijri (شمسی) string with Persian digits.
 * Guaranteed to calculate with Asia/Tehran timezone.
 *
 * Example outputs:
 *  - ۱۴۰۵/۰۷/۱۲ - ۰۱:۲۰
 *  - ۱۴۰۵/۰۷/۱۲
 *  - ۰۱:۲۰
 */
export function formatPersianDate(
  dateInput?: string | number | Date | null,
  options: FormatPersianDateOptions = { includeTime: true, separator: ' - ' }
): string {
  if (!dateInput) return '';

  const parts = getTehranDateParts(dateInput);
  if (!parts) {
    return typeof dateInput === 'string' ? toPersianDigits(dateInput) : '';
  }

  const yStr = toPersianDigits(parts.year.toString());
  const mStr = toPersianDigits(parts.month.toString().padStart(2, '0'));
  const dStr = toPersianDigits(parts.day.toString().padStart(2, '0'));
  const dateFormatted = `${yStr}/${mStr}/${dStr}`;

  if (options.timeOnly) {
    const hStr = toPersianDigits(parts.hour.toString().padStart(2, '0'));
    const minStr = toPersianDigits(parts.minute.toString().padStart(2, '0'));
    return `${hStr}:${minStr}`;
  }

  if (options.includeTime) {
    const hStr = toPersianDigits(parts.hour.toString().padStart(2, '0'));
    const minStr = toPersianDigits(parts.minute.toString().padStart(2, '0'));
    const sep = options.separator ?? ' - ';
    return `${dateFormatted}${sep}${hStr}:${minStr}`;
  }

  return dateFormatted;
}

/**
 * Universal order date formatter used across store, admin, visitor, and invoices.
 * Formats ISO timestamps (e.g. 2026-10-02T21:50:46.192976+00:00) into:
 * ۱۴۰۵/۰۷/۱۲ - ۰۱:۲۰ (Iran Standard Time)
 */
export function formatOrderDate(dateStr?: string | number | Date | null): string {
  return formatPersianDate(dateStr, { includeTime: true, separator: ' - ' });
}

/**
 * Returns a clean Jalali date string without time (e.g. ۱۴۰۵/۰۷/۱۲)
 */
export function formatPersianDateOnly(dateStr?: string | number | Date | null): string {
  return formatPersianDate(dateStr, { includeTime: false });
}
