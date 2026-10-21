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

// Helper: Format current time in Asia/Tehran timezone with YYYY/MM/DD HH:mm format
function formatTehranDateTime(date: Date = new Date()): string {
  try {
    const formatter = new Intl.DateTimeFormat('fa-IR-u-nu-latn', {
      timeZone: 'Asia/Tehran',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const parts = formatter.formatToParts(date);
    const m: Record<string, string> = {};
    for (const p of parts) {
      m[p.type] = p.value;
    }
    const year = m.year || '';
    const month = (m.month || '').padStart(2, '0');
    const day = (m.day || '').padStart(2, '0');
    const hour = (m.hour || '').padStart(2, '0');
    const minute = (m.minute || '').padStart(2, '0');
    return `${year}/${month}/${day} ${hour}:${minute}`;
  } catch (err) {
    console.warn('Error formatting Tehran time:', err);
    return date.toISOString().replace('T', ' ').substring(0, 16);
  }
}

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
        console.warn('Could not query admin telegram_chat_id from profiles:', e);
      }
    }

    const type = body.type || 'INSERT';
    const validTypes = ['INSERT', 'STORE_WELCOME', 'STORE_APPROVED', 'STORE_REJECTED'];
    if (!validTypes.includes(type)) {
      return new Response(
        JSON.stringify({ ok: true, success: true, skipped: 'unknown_type' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Direct store notification types: STORE_WELCOME, STORE_APPROVED, STORE_REJECTED
    if (type === 'STORE_WELCOME' || type === 'STORE_APPROVED' || type === 'STORE_REJECTED') {
      const record = body.record || body.store || body;
      const storeId = record.id;
      const name = record.name || 'فروشگاه شما';
      const approvalStatus = record.approval_status || 'pending';
      const approvalNote = record.approval_note || '';

      if (!storeId) {
        return new Response(
          JSON.stringify({ success: false, error: 'Missing record id' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      let targetUserId = null;
      if (adminClient) {
        try {
          const { data: linkRec } = await adminClient
            .from('telegram_links')
            .select('telegram_user_id')
            .eq('profile_id', storeId)
            .maybeSingle();

          if (linkRec?.telegram_user_id) {
            targetUserId = String(linkRec.telegram_user_id).trim();
          }
        } catch (e) {
          console.warn('Failed to query telegram_links:', e);
        }
      }

      if (!targetUserId) {
        return new Response(
          JSON.stringify({ ok: true, success: true, skipped: 'no_link' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      let text = '';
      let includeButton = false;

      if (type === 'STORE_WELCOME') {
        if (approvalStatus === 'pending') {
          text = `✅ حساب فروشگاه ${name} در بارفروش به این پیامرسان متصل شد.\nوضعیت: در انتظار تأیید مدیریت؛ پس از بررسی نتیجه از همینجا به شما اطلاع داده میشود.`;
        } else {
          text = `✅ حساب فروشگاه ${name} در بارفروش فعال و به این پیامرسان متصل شد.\nاز این پس تأیید سفارشها و اعلانها از همینجا برایتان ارسال میشود. هماکنون میتوانید سفارش ثبت کنید.`;
        }
        includeButton = true;
      } else if (type === 'STORE_APPROVED') {
        text = `🎉 ثبتنام فروشگاه ${name} تأیید شد. هماکنون میتوانید در بارفروش سفارش ثبت کنید.`;
        includeButton = true;
      } else if (type === 'STORE_REJECTED') {
        text = `❌ متأسفانه ثبتنام فروشگاه ${name} تأیید نشد.`;
        if (approvalNote) {
          text += `\n\nدلیل: ${approvalNote}`;
        }
        text += `\n\nبرای پیگیری با پشتیبانی تماس بگیرید.`;
        includeButton = false;
      }

      if (!tgBotToken) {
        return new Response(
          JSON.stringify({ success: false, error: 'TELEGRAM_BOT_TOKEN not configured' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const payloadBody: any = {
        chat_id: targetUserId,
        text: text,
      };

      if (includeButton) {
        payloadBody.reply_markup = {
          inline_keyboard: [
            [
              {
                text: '🛒 باز کردن بارفروش',
                web_app: { url: 'https://Barfroosh.ir' },
              },
            ],
          ],
        };
      }

      try {
        const tgRes = await fetch(`https://api.telegram.org/bot${tgBotToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payloadBody),
        });
        const tgJson = await tgRes.json();
        if (!tgJson.ok) {
          console.error('Telegram store status message failed:', tgJson);
        }
        return new Response(
          JSON.stringify({
            ok: true,
            success: true,
            message: 'پیام وضعیت فروشگاه ارسال شد.',
            result: tgJson,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (err) {
        console.error('Telegram store status fetch error:', err);
        return new Response(
          JSON.stringify({ ok: true, success: true, error: String(err) }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Path INSERT: Event A (Store registration/first login to Admins) OR Event B (Order)
    const rawRecord = body.record || body.store || body;
    const isOrderEvent =
      Boolean(body.order) ||
      Boolean(body.order_id) ||
      Boolean(rawRecord.order_id) ||
      (Boolean(rawRecord.id) && Boolean(rawRecord.supermarket_id) && rawRecord.total_amount !== undefined);

    if (!isOrderEvent) {
      // 1) Store registration or first-login event -> notify Admins
      const name = rawRecord.name || rawRecord.store_name || 'فروشگاه جدید';
      const owner = rawRecord.owner || rawRecord.owner_name || 'ثبت نشده';
      const phone = rawRecord.phone || rawRecord.mobile || 'بدون شماره';
      const address = rawRecord.address || 'ثبت نشده';
      const regSource = rawRecord.registration_source || 'مستقیم از وب‌سایت';

      let adminMsg = '';

      if (rawRecord.registration_source === 'imported_activated') {
        // Query visitor name if available
        let visitorName = rawRecord.visitor_name || '';
        if (!visitorName && rawRecord.assigned_visitor_id && adminClient) {
          try {
            const { data: vProf } = await adminClient
              .from('profiles')
              .select('name')
              .eq('id', rawRecord.assigned_visitor_id)
              .maybeSingle();
            if (vProf?.name) visitorName = vProf.name;
          } catch (e) {
            console.warn('Failed to query visitor profile:', e);
          }
        }
        if (!visitorName && rawRecord.id && adminClient) {
          try {
            const { data: smRec } = await adminClient
              .from('supermarkets')
              .select('assigned_visitor_id, visitor_name')
              .eq('id', rawRecord.id)
              .maybeSingle();
            if (smRec?.visitor_name) {
              visitorName = smRec.visitor_name;
            } else if (smRec?.assigned_visitor_id) {
              const { data: vProf } = await adminClient
                .from('profiles')
                .select('name')
                .eq('id', smRec.assigned_visitor_id)
                .maybeSingle();
              if (vProf?.name) visitorName = vProf.name;
            }
          } catch (e) {
            console.warn('Failed to query supermarket visitor:', e);
          }
        }
        if (!visitorName) {
          visitorName = 'تعیین‌نشده';
        }

        const tehranTime = formatTehranDateTime(new Date());
        adminMsg = `🔓 فروشگاه اکسلی برای اولین بار وارد سامانه شد\n\nنام فروشگاه: ${name}\nمالک: ${owner}\nموبایل: ${phone}\nآدرس: ${address}\nویزیتور: ${visitorName}\nزمان ورود: ${tehranTime}`;
      } else {
        // Default new store registration message
        adminMsg = `🛒 ثبت‌نام فروشگاه جدید در سامانه پخش فرهودی\n\nنام فروشگاه: ${name}\nمدیر / صاحب فروشگاه: ${owner}\nشماره همراه: ${phone}\nآدرس: ${address}\nمبدأ ثبت‌نام: ${regSource}\nزمان ثبت: ${new Date().toLocaleTimeString('fa-IR')}`;
      }

      if (!tgBotToken || adminChatIds.size === 0) {
        console.warn('Telegram token or admin recipients not configured');
        return new Response(
          JSON.stringify({
            ok: true,
            success: true,
            message: 'Webhook processed, but Telegram bot or admin chat_id is not configured',
            recipientsCount: adminChatIds.size,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const results: any[] = [];
      for (const chatId of adminChatIds) {
        try {
          const tgRes = await fetch(`https://api.telegram.org/bot${tgBotToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              text: adminMsg,
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
          ok: true,
          success: true,
          message: 'اعلان ادمین با موفقیت ارسال شد.',
          results,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Path INSERT: Event B: Order Confirmation
    let orderData = body.order || body.record || body;
    const orderId = orderData.id || orderData.order_id || body.order_id;
    let supermarketId = orderData.supermarket_id;

    let items: OrderLineItem[] = [];
    let s = {
      name: orderData.supermarket_name || 'فروشگاه شما',
      owner: 'مدیر محترم',
      phone: '',
      address: '',
      verification_type: '',
    };

    let storeTargetChatId =
      body.chat_id ||
      body.telegram_chat_id ||
      body.target_chat_id ||
      '';

    if (adminClient && orderId) {
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
        console.warn('Failed to query order for store notification:', err);
      }

      try {
        const { data: oItems } = await adminClient
          .from('order_items')
          .select('name, quantity, price, items_per_package, unit, discount_percent')
          .eq('order_id', orderId);

        if (oItems && Array.isArray(oItems)) {
          items = oItems;
        }
      } catch (err) {
        console.warn('Failed to query order_items for store notification:', err);
      }
    }

    if (items.length === 0 && Array.isArray(orderData.items)) {
      items = orderData.items;
    }

    if (adminClient && supermarketId) {
      try {
        const { data: dbStore } = await adminClient
          .from('supermarkets')
          .select('id, name, owner, phone, address, verification_type, telegram_chat_id')
          .eq('id', supermarketId)
          .maybeSingle();

        if (dbStore) {
          s.name = dbStore.name || s.name;
          s.owner = dbStore.owner || s.owner;
          s.phone = dbStore.phone || s.phone;
          s.address = dbStore.address || s.address;
          s.verification_type = dbStore.verification_type || '';
          if (!storeTargetChatId && dbStore.telegram_chat_id) {
            storeTargetChatId = dbStore.telegram_chat_id;
          }
        }
      } catch (err) {
        console.warn('Failed to fetch supermarket in telegram-notify-store:', err);
      }

      if (!storeTargetChatId) {
        try {
          const { data: prof } = await adminClient
            .from('profiles')
            .select('id, telegram_chat_id')
            .eq('id', supermarketId)
            .maybeSingle();
          if (prof?.telegram_chat_id) {
            storeTargetChatId = prof.telegram_chat_id;
          }
        } catch (e) {
          console.warn('Could not query profile telegram_chat_id:', e);
        }
      }
    }

    const isConsumer = s.verification_type === 'bulk_consumer';
    const orderDate = orderData.order_date
      ? new Date(orderData.order_date).toLocaleTimeString('fa-IR')
      : new Date().toLocaleTimeString('fa-IR');

    const fin = computeOrderFinancials(orderData, items, isConsumer);

    let itemsListHtml = '';
    if (items.length > 0) {
      const itemRows = items.map((it, idx) => {
        const qty = Number(it.quantity) || 0;
        const u = it.unit || 'عدد';
        const p = Number(it.items_per_package) > 1 ? Number(it.items_per_package) : 1;
        const unitPr = p > 1 ? Math.round(Number(it.price || 0) / p) : Number(it.price || 0);
        return `${idx + 1}. <b>${escapeHtml(it.name || 'کالا')}</b>: ${qty.toLocaleString('fa-IR')} ${u} (${unitPr.toLocaleString('fa-IR')} تومان)`;
      });
      itemsListHtml = `\n📦 <b>اقلام ثبت‌شده:</b>\n${itemRows.join('\n')}\n`;
    }

    const financialBlock = buildTelegramFinancialBlock(fin);

    const messageHtml = `
🛒 <b>سفارش شما با موفقیت ثبت شد</b>

جناب/سرکار <b>${escapeHtml(s.owner)}</b> (فروشگاه ${escapeHtml(s.name)})
سفارش شماره <code>${escapeHtml(orderId || 'نامشخص')}</code> با موفقیت در سیستم پخش ثبت گردید.

⏰ <b>زمان ثبت:</b> ${orderDate}
${itemsListHtml}
${financialBlock}

از حسن انتخاب و اعتماد شما سپاسگزاریم.
`.trim();

    if (!tgBotToken) {
      return new Response(
        JSON.stringify({ success: false, message: 'TELEGRAM_BOT_TOKEN not configured' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!storeTargetChatId) {
      console.warn('Store has no linked telegram_chat_id; skipped message delivery');
      return new Response(
        JSON.stringify({
          ok: true,
          success: true,
          message: 'فروشگاه حساب تلگرام متصل ندارد، اعلان تلگرام ارسال نشد.',
          skipped: true,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tgRes = await fetch(`https://api.telegram.org/bot${tgBotToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: storeTargetChatId,
        text: messageHtml,
        parse_mode: 'HTML',
      }),
    });
    const tgJson = await tgRes.json();
    if (!tgJson.ok) {
      console.error('Telegram store send failed:', tgJson);
    }

    return new Response(
      JSON.stringify({
        ok: true,
        success: true,
        message: 'نوتیفیکیشن تلگرام فروشگاه ارسال شد.',
        result: tgJson,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('telegram-notify-store function error:', err);
    return new Response(
      JSON.stringify({
        success: false,
        error: err.message || 'خطای سرور در ارسال اعلان تلگرام فروشگاه',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
