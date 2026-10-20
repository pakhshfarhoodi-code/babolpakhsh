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

function buildEitaaFinancialBlock(fin: FinancialResult): string {
  const lines: string[] = [];
  lines.push(`💰 جزئیات مالی فاکتور:`);
  lines.push(`▫️ جمع اولیه اقلام: ${fin.rawSubtotal.toLocaleString('fa-IR')} تومان`);
  if (fin.productDiscountAmount > 0) {
    lines.push(`▫️ تخفیف کالاها: ${fin.productDiscountAmount.toLocaleString('fa-IR')} تومان-`);
  }
  if (fin.orderDiscountAmount > 0) {
    lines.push(`▫️ تخفیف سفارش (${fin.orderDiscountLabel}): ${fin.orderDiscountAmount.toLocaleString('fa-IR')} تومان-`);
  }
  if (fin.taxAmount > 0) {
    lines.push(`▫️ مالیات بر ارزش افزوده: ${fin.taxAmount.toLocaleString('fa-IR')} تومان`);
  }
  lines.push(`💳 مبلغ نهایی قابل پرداخت: ${fin.payableAmount.toLocaleString('fa-IR')} تومان`);
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

    // Resolve Eitaa credentials from env or app_settings
    let eitaaToken = Deno.env.get('EITAA_BOT_TOKEN') || Deno.env.get('EITAAYAR_TOKEN') || '';
    let eitaaChatId = Deno.env.get('EITAA_ADMIN_CHAT_ID') || '';

    if (adminClient && (!eitaaToken || !eitaaChatId)) {
      try {
        const { data: settings } = await adminClient
          .from('app_settings')
          .select('key, value')
          .in('key', ['bot_notifications', 'eitaa_bot_token', 'eitaayar_token', 'eitaa_admin_chat_id']);

        if (settings && Array.isArray(settings)) {
          for (const s of settings) {
            if (s.key === 'bot_notifications' && typeof s.value === 'object' && s.value !== null) {
              eitaaToken = eitaaToken || s.value.eitaa_bot_token || s.value.eitaayar_token || '';
              eitaaChatId = eitaaChatId || s.value.eitaa_admin_chat_id || '';
            }
            if (s.key === 'eitaa_bot_token' || s.key === 'eitaayar_token') {
              eitaaToken = eitaaToken || String(s.value);
            }
            if (s.key === 'eitaa_admin_chat_id') {
              eitaaChatId = eitaaChatId || String(s.value);
            }
          }
        }
      } catch (e) {
        console.warn('Failed to load eitaa credentials from app_settings:', e);
      }
    }

    // Resolve all admin recipient chat IDs: role IN ('admin', 'superadmin')
    const adminChatIds = new Set<string>();
    if (eitaaChatId) {
      adminChatIds.add(String(eitaaChatId).trim());
    }

    if (adminClient) {
      try {
        const { data: adminProfiles } = await adminClient
          .from('profiles')
          .select('id, name, role, eitaa_chat_id')
          .in('role', ['admin', 'superadmin'])
          .not('eitaa_chat_id', 'is', null);

        if (adminProfiles && Array.isArray(adminProfiles)) {
          for (const p of adminProfiles) {
            if (p.eitaa_chat_id) {
              adminChatIds.add(String(p.eitaa_chat_id).trim());
            }
          }
        }
      } catch (e) {
        console.warn('Could not query admin eitaa_chat_id from profiles:', e);
      }
    }

    // Determine event type: Store Registration OR Order
    const isSupermarketEvent =
      body.table === 'supermarkets' ||
      body.type === 'store_registration' ||
      Boolean(body.store) ||
      (Boolean(body.name) && !body.order_id && !body.order && !body.table);

    let messageText = '';

    if (isSupermarketEvent) {
      // Event A: Store Registration Notification for Admin
      const storeData = body.store || body.record || body;
      const storeName = storeData.name || 'فروشگاه جدید';
      const storeOwner = storeData.owner || 'متصدی فروشگاه';
      const storePhone = storeData.phone || 'بدون شماره';
      const storeAddress = storeData.address || 'ثبت نشده';
      const regSource = storeData.registration_source || 'مستقیم از وب‌سایت';

      messageText = `
🛒 ثبت‌نام فروشگاه جدید در سامانه پخش فرهودی

🏪 نام فروشگاه: ${storeName}
👤 مدیر / صاحب فروشگاه: ${storeOwner}
📞 شماره همراه: ${storePhone}
📍 آدرس: ${storeAddress}
🌐 مبدأ ثبت‌نام: ${regSource}
⏰ زمان ثبت: ${new Date().toLocaleTimeString('fa-IR')}
`.trim();
    } else {
      // Event B: Order Placement Notification for Admin
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
          console.warn('Failed to fetch order record for eitaa-notify:', err);
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
          console.warn('Failed to fetch order items for eitaa-notify:', err);
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
          console.warn('Failed to fetch supermarket record in eitaa-notify:', err);
        }
      }

      const isConsumer = supermarketRecord?.verification_type === 'bulk_consumer';
      const storeName = supermarketRecord?.name || orderData.supermarket_name || 'فروشگاه نامشخص';
      const storeOwner = supermarketRecord?.owner || 'متصدی فروشگاه';
      const storePhone = supermarketRecord?.phone || '';
      const orderDate = orderData.order_date
        ? new Date(orderData.order_date).toLocaleTimeString('fa-IR')
        : new Date().toLocaleTimeString('fa-IR');

      const fin = computeOrderFinancials(orderData, items, isConsumer);

      let itemsListText = '';
      if (items.length > 0) {
        const itemRows = items.slice(0, 8).map((it, idx) => {
          const qty = Number(it.quantity) || 0;
          const u = it.unit || 'عدد';
          return `${idx + 1}. ${it.name || 'کالا'} (${qty} ${u})`;
        });
        if (items.length > 8) {
          itemRows.push(`... و ${items.length - 8} قلم دیگر`);
        }
        itemsListText = `\n📦 اقلام سفارش (${items.length} ردیف):\n${itemRows.join('\n')}\n`;
      }

      const financialBlock = buildEitaaFinancialBlock(fin);

      messageText = `
🛍️ سفارش جدید در سامانه پخش فرهودی

🆔 شماره سفارش: ${orderId || 'نامشخص'}
🏪 فروشگاه: ${storeName}
👤 مدیر فروشگاه: ${storeOwner}${storePhone ? `\n📞 تماس: ${storePhone}` : ''}
⏰ زمان: ${orderDate}
${itemsListText}
${financialBlock}
`.trim();
    }

    if (!eitaaToken || adminChatIds.size === 0) {
      console.warn('Eitaa token or admin recipients not configured');
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Webhook processed, but Eitaa bot or admin chat_id is not configured',
          recipientsCount: adminChatIds.size,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const eitaaUrl = eitaaToken.startsWith('bot')
      ? `https://eitaayar.ir/api/${eitaaToken}/sendMessage`
      : `https://eitaayar.ir/api/v1/${eitaaToken}/sendMessage`;

    // Send to all admin recipients and verify ok === true from parsed JSON
    const results: any[] = [];
    for (const chatId of adminChatIds) {
      try {
        const eitaaRes = await fetch(eitaaUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: messageText,
          }),
        });

        let eitaaJson: any = null;
        try {
          eitaaJson = await eitaaRes.json();
        } catch (jsonErr) {
          console.error(`Failed to parse Eitaayar response as JSON for ${chatId}:`, jsonErr);
          eitaaJson = { ok: false, error: 'Invalid JSON response from Eitaayar' };
        }

        const isOk = Boolean(eitaaJson && eitaaJson.ok === true);
        if (!isOk) {
          console.error(`Eitaa admin send failed for ${chatId}:`, eitaaJson);
        }

        results.push({
          chat_id: chatId,
          ok: isOk,
          response: eitaaJson,
        });
      } catch (err) {
        console.error(`Eitaa fetch error for ${chatId}:`, err);
        results.push({ chat_id: chatId, ok: false, error: String(err) });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'نوتیفیکیشن ایتا ادمین ارسال شد.',
        results,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('eitaa-notify function error:', err);
    return new Response(
      JSON.stringify({
        success: false,
        error: err.message || 'خطای سرور در ارسال اعلان ایتا ادمین',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
