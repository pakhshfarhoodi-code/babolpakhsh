// Persian date and digit helper functions for Visitor Portal

import {
  getTodayJalali as getTodayJalaliUtil,
  getTehranDateParts,
  isTodayInTehran,
  formatOrderDate as formatOrderDateUtil,
  toEnglishDigits as toEngDigits,
  jalaliToDayCount as jalaliDays,
} from '../../utils/dateUtils';

export const toEnglishDigits = toEngDigits;
export const jalaliToDayCount = jalaliDays;

export interface JalaliDateParts {
  year: number;
  month: number;
  day: number;
}

export const getTodayJalali = (): JalaliDateParts => {
  return getTodayJalaliUtil();
};

export const parseJalaliDate = (dateStr?: string): JalaliDateParts | null => {
  if (!dateStr) return null;
  const parts = getTehranDateParts(dateStr);
  if (!parts) return null;
  return { year: parts.year, month: parts.month, day: parts.day };
};

export const isToday = (dateStr?: string): boolean => {
  return isTodayInTehran(dateStr);
};

export const formatOrderDate = (dateStr?: string): string => {
  return formatOrderDateUtil(dateStr);
};

export const formatPrice = (price: number): string => {
  return price.toLocaleString('fa-IR');
};
