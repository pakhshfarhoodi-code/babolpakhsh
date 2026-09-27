/**
 * Converts numbers into Persian words (e.g. 1450000 -> "یک میلیون و چهارصد و پنجاه هزار تومان")
 */

const UNITS = ['', 'یک', 'دو', 'سه', 'چهار', 'پنج', 'شش', 'هفت', 'هشت', 'نه'];
const TEENS = [
  'ده',
  'یازده',
  'دوازده',
  'سیزده',
  'چهارده',
  'پانزده',
  'شانزده',
  'هفده',
  'هجده',
  'نوزده',
];
const TENS = ['', 'ده', 'بیست', 'سی', 'چهل', 'پنجاه', 'شصت', 'هفتاد', 'هشتاد', 'نود'];
const HUNDREDS = [
  '',
  'یکصد',
  'دویست',
  'سیصد',
  'چهارصد',
  'پانصد',
  'ششصد',
  'هفتصد',
  'هشتصد',
  'نهصد',
];
const SCALES = ['', 'هزار', 'میلیون', 'میلیارد', 'تریلیون'];

function convertThreeDigits(num: number): string[] {
  const parts: string[] = [];
  const h = Math.floor(num / 100);
  const remainder = num % 100;

  if (h > 0) {
    parts.push(HUNDREDS[h]);
  }

  if (remainder >= 10 && remainder < 20) {
    parts.push(TEENS[remainder - 10]);
  } else {
    const t = Math.floor(remainder / 10);
    const u = remainder % 10;
    if (t > 0) parts.push(TENS[t]);
    if (u > 0) parts.push(UNITS[u]);
  }

  return parts;
}

export function numberToPersianWords(num: number): string {
  if (num === 0) return 'صفر';
  if (isNaN(num)) return '';

  const isNegative = num < 0;
  let absNum = Math.abs(Math.floor(num));

  const chunks: number[] = [];
  while (absNum > 0) {
    chunks.push(absNum % 1000);
    absNum = Math.floor(absNum / 1000);
  }

  const resultWords: string[] = [];

  for (let i = chunks.length - 1; i >= 0; i--) {
    const chunk = chunks[i];
    if (chunk === 0) continue;

    const chunkWords = convertThreeDigits(chunk);
    const scale = SCALES[i];

    if (chunkWords.length > 0) {
      const chunkStr = chunkWords.join(' و ');
      if (scale) {
        resultWords.push(`${chunkStr} ${scale}`);
      } else {
        resultWords.push(chunkStr);
      }
    }
  }

  const words = (isNegative ? 'منفی ' : '') + resultWords.join(' و ');
  return words;
}

export function formatPriceToWords(amount: number): string {
  if (!amount || amount === 0) return 'صفر تومان';
  const words = numberToPersianWords(amount);
  return `${words} تومان`;
}
