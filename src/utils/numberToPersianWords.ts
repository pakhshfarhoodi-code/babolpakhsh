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
 * Extracts a 2-digit or N-digit numeric code from an ID or username string.
 * If entityList is provided, it calculates a 1-based sequential index (01, 02, 03...)
 * based on creation order or list position.
 */
export function extractCodeFromId(
  id: string,
  defaultLength: number = 2,
  entityList?: Array<{ id: string; username?: string; created_at?: string }>
): string {
  if (!id) return '01';

  // 1. If entity list is provided, try finding 1-based index in the array
  if (entityList && Array.isArray(entityList) && entityList.length > 0) {
    const sorted = [...entityList].sort((a, b) => {
      const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
      if (timeA !== timeB) return timeA - timeB;
      return a.id.localeCompare(b.id);
    });
    const index = sorted.findIndex((item) => item.id === id || (item.username && item.username === id));
    if (index >= 0) {
      const seqNum = index + 1;
      return String(seqNum).padStart(defaultLength, '0');
    }
  }

  // 2. Extract digits if id contains short explicit digits (e.g., 'vs01' -> '01', 'sp-04' -> '04', 'vis-1' -> '01')
  const digits = id.replace(/\D/g, '');
  if (digits && digits.length <= 4) {
    return digits.padStart(defaultLength, '0');
  }

  // 3. Fallback for UUIDs without entity list: deterministic hash from 01 to 99
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash << 5) - hash + id.charCodeAt(i);
    hash |= 0;
  }
  const positive = (Math.abs(hash) % 99) + 1;
  return String(positive).padStart(defaultLength, '0');
}

export interface InvoiceNumberParams {
  orderSource: 'visitor' | 'supermarket';
  visitorId?: string;
  supermarketId?: string;
  visitors?: Array<{ id: string; username?: string; created_at?: string }>;
  supermarkets?: Array<{ id: string; username?: string; created_at?: string }>;
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
 * - Visitor: VS{visitorCode}-{overallSeq}-{visitorSeq} (e.g. VS01-1001-1, VS04-3359-17)
 * - Supermarket: SP{storeCode}-{overallSeq}-{storeSeq} (e.g. SP04-1001-1, SP247-5488-39)
 */
export function generateStructuredInvoiceNumber({
  orderSource,
  visitorId,
  supermarketId,
  visitors = [],
  supermarkets = [],
  existingOrders = [],
}: InvoiceNumberParams): string {
  const BASE_OFFSET = 1000;

  if (orderSource === 'visitor') {
    // 1. Visitor code formatted (e.g., 01, 02, 04)
    const visitorCode = extractCodeFromId(visitorId || 'vis-1', 2, visitors);

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
    // 1. Supermarket code formatted (e.g., 01, 04, 247)
    const storeCode = extractCodeFromId(supermarketId || 'sp-1', 2, supermarkets);

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

export interface LoadingBillNumberParams {
  visitorId: string;
  visitors?: Array<{ id: string; username?: string; created_at?: string }>;
  existingBills?: Array<{
    id: string;
    invoice_no?: string | null;
    visitor_id?: string;
  }>;
}

/**
 * Generates custom structured Loading Bill / Visitor Invoice number:
 * Format: VS{visitorCode}-{overallSeq}-{visitorSeq} (e.g. VS01-1025-1)
 * Unifies Loading Bill and Visitor Invoice so they share the exact same number,
 * eliminating duplicate secondary numbering (like F-0000 and random BL hashes).
 */
export function generateStructuredLoadingBillNumber({
  visitorId,
  visitors = [],
  existingBills = [],
}: LoadingBillNumberParams): string {
  const BASE_OFFSET = 1000;
  const visitorCode = extractCodeFromId(visitorId || 'vis-1', 2, visitors);

  // 1. Count overall visitor bills + 1
  const overallSeq = BASE_OFFSET + existingBills.length + 1;

  // 2. Count specific visitor's bills + 1
  const specificVisitorBills = existingBills.filter(
    (b) =>
      b.visitor_id === visitorId ||
      (b.id && b.id.startsWith(`VS${visitorCode}`)) ||
      (b.invoice_no && b.invoice_no.startsWith(`VS${visitorCode}`))
  );
  const visitorSeq = specificVisitorBills.length + 1;

  return `VS${visitorCode}-${overallSeq}-${visitorSeq}`;
}

/**
 * Cleanly formats any bill/invoice number to the unified visitor format:
 * Format: VS{visitorCode}-{overallSeq}-{visitorSeq} (e.g. VS01-1001-1)
 * Guaranteed to NEVER output legacy F-XXXXX or BL-XXXXX strings.
 */
export function formatUnifiedBillNumber(
  billId?: string | null,
  invoiceNo?: string | null,
  visitorId?: string | null
): string {
  // 1. If invoiceNo is already in standard VS format (e.g. VS01-1001-1), use it
  if (invoiceNo && /^VS\d{2}-\d+-\d+/i.test(invoiceNo)) {
    return invoiceNo.toUpperCase();
  }

  // 2. If billId is already in standard VS format, use it
  if (billId && /^VS\d{2}-\d+-\d+/i.test(billId)) {
    return billId.toUpperCase();
  }

  // 3. Extract visitor code (defaults to '01')
  let visCode = '01';
  if (visitorId) {
    const digits = visitorId.replace(/\D/g, '');
    if (digits) visCode = digits.slice(-2).padStart(2, '0');
  }

  // Check candidate string
  const raw = (invoiceNo && invoiceNo.trim() !== '') ? invoiceNo.trim() : (billId || '').trim();

  // If candidate is already starting with VS
  if (raw.startsWith('VS')) {
    return raw;
  }

  // If candidate is like F-00001, F-00003, F1, F0001, etc.
  const fMatch = raw.match(/^F-?(\d+)/i);
  if (fMatch) {
    const num = parseInt(fMatch[1], 10) || 1;
    const overallSeq = num >= 1000 ? num : 1000 + num;
    const subSeq = num >= 1000 ? Math.max(1, num - 1000) : num;
    return `VS${visCode}-${overallSeq}-${subSeq}`;
  }

  // If candidate starts with BL- (e.g. BL-6736-261008021151-36B) or is a UUID / hash
  if (raw.startsWith('BL-') || /^[0-9a-f-]{10,}$/i.test(raw)) {
    const digits = raw.replace(/\D/g, '');
    const num = digits ? (parseInt(digits.slice(-4), 10) || 1) : 1;
    const overallSeq = 1000 + (num % 1000 || 1);
    return `VS${visCode}-${overallSeq}-1`;
  }

  // If raw is numeric (e.g. "1" or "1001")
  if (/^\d+$/.test(raw)) {
    const num = parseInt(raw, 10);
    const overallSeq = num >= 1000 ? num : 1000 + num;
    const subSeq = num >= 1000 ? Math.max(1, num - 1000) : num;
    return `VS${visCode}-${overallSeq}-${subSeq}`;
  }

  // If raw is empty or something else
  if (!raw) {
    return `VS${visCode}-1001-1`;
  }

  // Fallback: clean out any F- or BL- prefix and wrap as VS
  const cleaned = raw.replace(/^(F-|BL-)/i, '').replace(/[^a-zA-Z0-9-]/g, '');
  return `VS${visCode}-${cleaned || '1001-1'}`;
}
