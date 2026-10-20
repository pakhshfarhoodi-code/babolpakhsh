// @ts-nocheck
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Constant-time string comparison to prevent timing attacks
function constantTimeEqual(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const enc = new TextEncoder();
  const aBytes = enc.encode(a);
  const bBytes = enc.encode(b);
  if (aBytes.length !== bBytes.length) return false;
  let diff = 0;
  for (let i = 0; i < aBytes.length; i++) {
    diff |= aBytes[i] ^ bBytes[i];
  }
  return diff === 0;
}

// HTML escape helper for safe Telegram HTML formatting
function escapeHtml(text: string = ''): string {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Helper: compute order financials strictly conforming to getOrderPricing / computeLine
interface OrderLineItem {
  name?: string;
  quantity: number;
  price: number;
  items_per_package?: number;
  discount_percent?: number | null;
  unit?: string;
}

interface FinancialResult {
  rawSubtotal: number;
  productDiscountAmount: number;
  orderDiscountAmount: number;
  totalDiscountAmount: number;
  orderDiscountLabel: string;
  taxAmount: number;
  payableAmount: number;
  itemsCount: number;
}

function computeOrderFinancials(
  order: {
    total_amount?: number;
    pickup_discount_percent?: number;
    founder_discount_percent?: number;
    discount_percent?: number;
    discount_status?: string;
  },
  items: OrderLineItem[],
  isConsumer: boolean = false
): FinancialResult {
  const pickupPercent = isConsumer ? 0 : Number(order.pickup_discount_percent || 0);
  const founderPercent = isConsumer ? 0 : Number(order.founder_discount_percent || 0);
  const manualPercent =
    isConsumer || order.discount_status !== 'approved' ? 0 : Number(order.discount_percent || 0);
  const totalOrderDiscountPercent = isConsumer
    ? 0
    : Math.min(100, Math.max(0, pickupPercent + founderPercent + manualPercent));

  let rawSubtotal = 0;
  let itemDiscSubtotal = 0;
  let finalSubtotal = 0;

  for (const item of items) {
    const qty = Number(item.quantity) || 0;
    const pack = Number(item.items_per_package) > 1 ? Number(item.items_per_package) : 1;
    const rawPrice = Number(item.price) || 0;
    const unitPrice = pack > 1 ? Math.round(rawPrice / pack) : rawPrice;

    const itemDisc = isConsumer
      ? 0
      : Math.max(0, Math.min(100, Number(item.discount_percent || 0)));

    const itemDiscountedUnitPrice = Math.round((unitPrice * (100 - itemDisc)) / 100);
    const combinedPercent = Math.min(100, itemDisc + totalOrderDiscountPercent);
    const discountedUnitPrice = Math.round((unitPrice * (100 - combinedPercent)) / 100);
    const lineTotal = Math.round(qty * pack * discountedUnitPrice);
    const lineRawTotal = Math.round(qty * pack * unitPrice);
    const lineItemDiscTotal = Math.round(qty * pack * itemDiscountedUnitPrice);

    rawSubtotal += lineRawTotal;
    itemDiscSubtotal += lineItemDiscTotal;
    finalSubtotal += lineTotal;
  }

  // Fall back to saved total_amount only when items are empty
  if (items.length === 0) {
    finalSubtotal = Number(order.total_amount || 0);
    rawSubtotal = finalSubtotal;
    itemDiscSubtotal = finalSubtotal;
  }

  const productDiscountAmount = Math.max(0, rawSubtotal - itemDiscSubtotal);
  const totalDiscountAmount = Math.max(0, rawSubtotal - finalSubtotal);
  const orderDiscountAmount = Math.max(0, totalDiscountAmount - productDiscountAmount);
  const taxAmount = 0;
  const payableAmount = finalSubtotal + taxAmount;

  const labelParts: string[] = [];
  if (pickupPercent > 0) labelParts.push(`تحویل حضوری ${pickupPercent}٪`);
  if (founderPercent > 0) labelParts.push(`فروشگاه مؤسس ${founderPercent}٪`);
  if (manualPercent > 0) labelParts.push(`تخفیف توافقی ${manualPercent}٪`);
  const orderDiscountLabel = labelParts.length > 0 ? labelParts.join(' + ') : 'تخفیف سفارش';

  return {
    rawSubtotal,
    productDiscountAmount,
    orderDiscountAmount,
    totalDiscountAmount,
    orderDiscountLabel,
    taxAmount,
    payableAmount,
    itemsCount: items.length,
  };
}

function buildTelegramFinancialBlock(fin: FinancialResult): string {
  const lines: string[] = [];
  lines.push(`💰 <b>جزئیات مالی فاکتور:</b>`);
  lines.push(`▫️ <b>جمع اولیه اقلام:</b> ${fin.rawSubtotal.toLocaleString('fa-IR')} تومان`);
  if (fin.productDiscountAmount > 0) {
    lines.push(`▫️ <b>تخفیف کالاها:</b> ${fin.productDiscountAmount.toLocaleString('fa-IR')} تومان-`);
  }
  if (fin.orderDiscountAmount > 0) {
    lines.push(`▫️ <b>تخفیف سفارش (${fin.orderDiscountLabel}):</b> ${fin.orderDiscountAmount.toLocaleString('fa-IR')} تومان-`);
  }
  if (fin.taxAmount > 0) {
    lines.push(`▫️ <b>مالیات بر ارزش افزوده:</b> ${fin.taxAmount.toLocaleString('fa-IR')} تومان`);
  }
  lines.push(`💳 <b>مبلغ نهایی قابل پرداخت:</b> <b>${fin.payableAmount.toLocaleString('fa-IR')} تومان</b>`);
  return lines.join('\n');
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // 1. Validate x-webhook-secret in constant time
  const incomingSecret = req.headers.get('x-webhook-secret');
  if (!incomingSecret) {
    return new Response(
      JSON.stringify({ success: false, error: 'Unauthorized: missing x-webhook-secret header' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const configuredSecret =
    Deno.env.get('WEBHOOK_SECRET') ||
    Deno.env.get('NOTIFY_WEBHOOK_SECRET') ||
    Deno.env.get('SUPABASE_WEBHOOK_SECRET') ||
    '';

  if (configuredSecret && !constantTimeEqual(incomingSecret.trim(), configuredSecret.trim())) {
    return new Response(
      JSON.stringify({ success: false, error: 'Unauthorized: invalid x-webhook-secret header' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceRoleKey =
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ||
      Deno.env.get('SERVICE_ROLE_KEY') ||
      Deno.env.get('SUPABASE_SECRET_KEYS') ||
      '';

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    let adminClient: any = null;
    if (supabaseUrl && supabaseServiceRoleKey) {
      adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
    }

    // Resolve Telegram bot credentials from env or app_settings
    let tgBotToken = Deno.env.get('TELEGRAM_BOT_TOKEN') || '';
    let tgChatId = Deno.env.get('TELEGRAM_ADMIN_CHAT_ID') || '';

    if (adminClient && (!tgBotToken || !tgChatId)) {
      try {
        const { data: settings } = await adminClient
          .from('app_settings')
          .select('key, value')
          .in('key', ['bot_notifications', 'telegram_bot_token', 'telegram_admin_chat_id']);

        if (settings && Array.isArray(settings)) {
          for (const s of settings) {
            if (s.key === 'bot_notifications' && typeof s.value === 'object' && s.value !== null) {
              tgBotToken = tgBotToken || s.value.telegram_bot_token || '';
              tgChatId = tgChatId || s.value.telegram_admin_chat_id || '';
            }
            if (s.key === 'telegram_bot_token') tgBotToken = tgBotToken || String(s.value);
            if (s.key === 'telegram_admin_chat_id') tgChatId = tgChatId || String(s.value);
          }
        }
      } catch (e) {
        console.warn('Failed to load telegram bot credentials from app_settings:', e);
      }
    }

    // Resolve all admin recipient chat IDs: role IN ('admin', 'superadmin')
    const adminChatIds = new Set<string>();
    if (tgChatId) {
      adminChatIds.add(String(tgChatId).trim());
    }

    if (adminClient) {
      try {
        const { data: adminProfiles } = await adminClient
          .from('profiles')
          .select('id, name, role, telegram_chat_id')
          .in('role', ['admin', 'superadmin'])
          .not('telegram_chat_id', 'is', null);

        if (adminProfiles && Array.isArray(adminProfiles)) {
          for (const p of adminProfiles) {
            if (p.telegram_chat_id) {
              adminChatIds.add(String(p.telegram_chat_id).trim());
            }
          }
        }
      } catch (e) {
        // telegram_chat_id column might not be present; keep env/settings chat id
        console.warn('Could not query admin telegram_chat_id from profiles:', e);
      }
    }

    // Determine event type: Order or Store Registration
    const isSupermarketEvent =
      body.table === 'supermarkets' ||
      body.type === 'store_registration' ||
      Boolean(body.store) ||
      (Boolean(body.name) && !body.order_id && !body.order && !body.table);

    let messageHtml = '';

    if (isSupermarketEvent) {
      // Event A: Store Registration Notification for Admins
      const storeData = body.store || body.record || body;
      const storeName = storeData.name || 'فروشگاه جدید';
      const storeOwner = storeData.owner || 'متصدی فروشگاه';
      const storePhone = storeData.phone || 'بدون شماره';
      const storeAddress = storeData.address || 'ثبت نشده';
      const regSource = storeData.registration_source || 'مستقیم از وب‌سایت';

      messageHtml = `
🛒 <b>ثبت‌نام فروشگاه جدید در سامانه پخش فرهودی</b>

🏪 <b>نام فروشگاه:</b> ${escapeHtml(storeName)}
👤 <b>مدیر / صاحب فروشگاه:</b> ${escapeHtml(storeOwner)}
📞 <b>شماره همراه:</b> <code>${escapeHtml(storePhone)}</code>
📍 <b>آدرس:</b> ${escapeHtml(storeAddress)}
🌐 <b>مبدأ ثبت‌نام:</b> ${escapeHtml(regSource)}
⏰ <b>زمان ثبت:</b> ${new Date().toLocaleTimeString('fa-IR')}
`.trim();
    } else {
      // Event B: Order Placement Notification for Admins
      let orderData = body.order || body.record || body;
      let orderId = orderData.id || orderData.order_id || body.order_id;
      let supermarketId = orderData.supermarket_id;

      let items: OrderLineItem[] = [];
      let supermarketRecord: any = null;

      if (adminClient && orderId) {
        // Query order columns without customer_type and consumer_savings
        try {
          const { data: oRec } = await adminClient
            .from('orders')
            .select(
              'id, supermarket_id, supermarket_name, assigned_visitor_id, visitor_name, status, total_amount, order_source, order_channel, order_date, pickup_discount_percent, founder_discount_percent, discount_percent, discount_status'
            )
            .eq('id', orderId)
            .maybeSingle();

          if (oRec) {
            orderData = { ...oRec, ...orderData };
            supermarketId = oRec.supermarket_id || supermarketId;
          }
        } catch (err) {
          console.warn('Failed to fetch order record:', err);
        }

        // Query order items with discount_percent column
        try {
          const { data: oItems } = await adminClient
            .from('order_items')
            .select('name, quantity, price, items_per_package, unit, discount_percent')
            .eq('order_id', orderId);

          if (oItems && Array.isArray(oItems)) {
            items = oItems;
          }
        } catch (err) {
          console.warn('Failed to fetch order items:', err);
        }
      }

      if (items.length === 0 && Array.isArray(orderData.items)) {
        items = orderData.items;
      }

      // Query supermarket to determine bulk_consumer verification type and details
      if (adminClient && supermarketId) {
        try {
          const { data: sm } = await adminClient
            .from('supermarkets')
            .select('id, name, owner, phone, address, verification_type')
            .eq('id', supermarketId)
            .maybeSingle();

          if (sm) {
            supermarketRecord = sm;
          }
        } catch (err) {
          console.warn('Failed to fetch supermarket record:', err);
        }
      }

      const isConsumer = supermarketRecord?.verification_type === 'bulk_consumer';
      const storeName = supermarketRecord?.name || orderData.supermarket_name || 'فروشگاه نامشخص';
      const storeOwner = supermarketRecord?.owner || 'متصدی فروشگاه';
      const storePhone = supermarketRecord?.phone || '';
      const orderDate = orderData.order_date
        ? new Date(orderData.order_date).toLocaleTimeString('fa-IR')
        : new Date().toLocaleTimeString('fa-IR');

      // Compute exact financial block matching utils/orderLine.ts
      const fin = computeOrderFinancials(orderData, items, isConsumer);

      // Build items summary preview
      let itemsListHtml = '';
      if (items.length > 0) {
        const itemRows = items.slice(0, 8).map((it, idx) => {
          const qty = Number(it.quantity) || 0;
          const u = it.unit || 'عدد';
          return `${idx + 1}. ${escapeHtml(it.name || 'کالا')} (${qty} ${u})`;
        });
        if (items.length > 8) {
          itemRows.push(`... و ${items.length - 8} قلم دیگر`);
        }
        itemsListHtml = `\n📦 <b>اقلام سفارش (${items.length} ردیف):</b>\n${itemRows.join('\n')}\n`;
      }

      const financialBlock = buildTelegramFinancialBlock(fin);

      messageHtml = `
🛍️ <b>سفارش جدید در سامانه پخش فرهودی</b>

🆔 <b>شماره سفارش:</b> <code>${escapeHtml(orderId || 'نامشخص')}</code>
🏪 <b>فروشگاه:</b> ${escapeHtml(storeName)}
👤 <b>مدیر فروشگاه:</b> ${escapeHtml(storeOwner)}${storePhone ? `\n📞 <b>تماس:</b> <code>${escapeHtml(storePhone)}</code>` : ''}
⏰ <b>زمان:</b> ${orderDate}
${itemsListHtml}
${financialBlock}
`.trim();
    }

    if (!tgBotToken || adminChatIds.size === 0) {
      console.warn('Telegram token or admin recipients not configured');
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Webhook processed, but Telegram bot or admin chat_id is not configured',
          recipientsCount: adminChatIds.size,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Send to all admin recipients
    const results: any[] = [];
    for (const chatId of adminChatIds) {
      try {
        const tgRes = await fetch(`https://api.telegram.org/bot${tgBotToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: messageHtml,
            parse_mode: 'HTML',
          }),
        });
        const json = await tgRes.json();
        results.push({ chat_id: chatId, ok: json.ok, error: json.description });
        if (!json.ok) {
          console.error(`Telegram admin send failed for ${chatId}:`, json);
        }
      } catch (err) {
        console.error(`Telegram fetch error for ${chatId}:`, err);
        results.push({ chat_id: chatId, ok: false, error: String(err) });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'نوتیفیکیشن تلگرام ادمین ارسال شد.',
        results,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('telegram-notify function error:', err);
    return new Response(
      JSON.stringify({
        success: false,
        error: err.message || 'خطای سرور در ارسال اعلان تلگرام ادمین',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
