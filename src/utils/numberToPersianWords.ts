/**
 * Persian Number to Words Converter & Invoice Numbering Utilities
 * 
 * Supports standard Iranian distribution invoice numbering:
 * - Visitor Order Format: VS{visitorCode}-{overallSeq}-{visitorSeq} (e.g. VS04-3359-17)
 * - Supermarket Direct Format: SP{storeCode}-{overallSeq}-{storeSeq} (e.g. SP247-5488-39)
 * Base sequence starts from 1000.
 */

const ONES = ['', 'یک', 'دو', 'سه', 'چهار', 'پنج', 'شش', 'هفت', 'هشت', 'نه'];
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
const TENS = ['', '', 'بیست', 'سی', 'چهل', 'پنجاه', 'شصت', 'هفتاد', 'هشتاد', 'نود'];
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

function convertThreeDigits(num: number): string {
  if (num === 0) return '';
  const parts: string[] = [];

  const h = Math.floor(num / 100);
  const remainder = num % 100;

  if (h > 0) parts.push(HUNDREDS[h]);

  if (remainder >= 10 && remainder <= 19) {
    parts.push(TEENS[remainder - 10]);
  } else {
    const t = Math.floor(remainder / 10);
    const o = remainder % 10;
    if (t > 0) parts.push(TENS[t]);
    if (o > 0) parts.push(ONES[o]);
  }

  return parts.join(' و ');
}

export function numberToPersianWords(num: number): string {
  if (num === 0) return 'صفر';
  if (num < 0) return 'منفی ' + numberToPersianWords(Math.abs(num));

  const chunks: number[] = [];
  let temp = Math.floor(num);

  while (temp > 0) {
    chunks.push(temp % 1000);
    temp = Math.floor(temp / 1000);
  }

  const wordsParts: string[] = [];

  for (let i = chunks.length - 1; i >= 0; i--) {
    const chunk = chunks[i];
    if (chunk > 0) {
      const words = convertThreeDigits(chunk);
      const scale = SCALES[i];
      if (scale) {
        wordsParts.push(`${words} ${scale}`);
      } else {
        wordsParts.push(words);
      }
    }
  }

  return wordsParts.join(' و ');
}

export function formatPriceToWords(amount: number): string {
  if (!amount || amount <= 0) return 'صفر تومان';
  const words = numberToPersianWords(amount);
  return `${words} تومان تمام`;
}

/**
 * Extracts a numeric code from an ID string (e.g. 'vis-4' -> '04', 'sp-247' -> '247')
 */
export function extractCodeFromId(id: string, defaultLength: number = 2): string {
  if (!id) return '01';
  const digits = id.replace(/\D/g, '');
  if (digits) {
    return digits.length < defaultLength ? digits.padStart(defaultLength, '0') : digits;
  }
  // If no digits, hash the string to a consistent number
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash << 5) - hash + id.charCodeAt(i);
    hash |= 0;
  }
  const positive = Math.abs(hash) % 1000;
  return String(positive).padStart(defaultLength, '0');
}

export interface InvoiceNumberParams {
  orderSource: 'visitor' | 'supermarket';
  visitorId?: string;
  supermarketId?: string;
  existingOrders: Array<{
    id: string;
    order_source?: 'visitor' | 'supermarket';
    assigned_visitor_id?: string;
    supermarket_id?: string;
  }>;
}

/**
 * Generates custom structured invoice number according to business specifications:
 * - Base starts from 1000
 * - Visitor: VS{visitorCode}-{overallSeq}-{visitorSeq} (e.g. VS04-3359-17)
 * - Supermarket: SP{storeCode}-{overallSeq}-{storeSeq} (e.g. SP247-5488-39)
 */
export function generateStructuredInvoiceNumber({
  orderSource,
  visitorId,
  supermarketId,
  existingOrders = [],
}: InvoiceNumberParams): string {
  const BASE_OFFSET = 1000;

  if (orderSource === 'visitor') {
    // 1. Visitor code formatted (e.g., 04, 12)
    const visitorCode = extractCodeFromId(visitorId || 'vis-1', 2);

    // 2. Count overall visitor orders + 1
    const visitorOrders = existingOrders.filter(
      (o) => (o.order_source === 'visitor') || (o.id && o.id.startsWith('VS'))
    );
    const overallSeq = BASE_OFFSET + visitorOrders.length + 1;

    // 3. Count specific visitor's orders + 1
    const specificVisitorOrders = existingOrders.filter(
      (o) => o.assigned_visitor_id === visitorId || (o.id && o.id.startsWith(`VS${visitorCode}`))
    );
    const visitorSeq = specificVisitorOrders.length + 1;

    return `VS${visitorCode}-${overallSeq}-${visitorSeq}`;
  } else {
    // 1. Supermarket code formatted (e.g., 247, 08)
    const storeCode = extractCodeFromId(supermarketId || 'sp-1', 2);

    // 2. Count overall supermarket direct orders + 1
    const supermarketOrders = existingOrders.filter(
      (o) => (o.order_source === 'supermarket') || (o.id && o.id.startsWith('SP'))
    );
    const overallSeq = BASE_OFFSET + supermarketOrders.length + 1;

    // 3. Count specific supermarket's orders + 1
    const specificStoreOrders = existingOrders.filter(
      (o) => o.supermarket_id === supermarketId || (o.id && o.id.startsWith(`SP${storeCode}`))
    );
    const storeSeq = specificStoreOrders.length + 1;

    return `SP${storeCode}-${overallSeq}-${storeSeq}`;
  }
}
