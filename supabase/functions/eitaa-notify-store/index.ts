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
    if (adminClient && !eitaaToken) {
      try {
        const { data: settings } = await adminClient
          .from('app_settings')
          .select('key, value')
          .in('key', ['bot_notifications', 'eitaa_bot_token', 'eitaayar_token']);

        if (settings && Array.isArray(settings)) {
          for (const s of settings) {
            if (s.key === 'bot_notifications' && typeof s.value === 'object' && s.value !== null) {
              eitaaToken = eitaaToken || s.value.eitaa_bot_token || s.value.eitaayar_token || '';
            }
            if (s.key === 'eitaa_bot_token' || s.key === 'eitaayar_token') {
              eitaaToken = eitaaToken || String(s.value);
            }
          }
        }
      } catch (e) {
        console.warn('Failed to load eitaa bot token from app_settings:', e);
      }
    }

    const type = body.type || 'INSERT';
    const validTypes = ['INSERT', 'STORE_WELCOME', 'STORE_APPROVED', 'STORE_REJECTED'];
    if (!validTypes.includes(type)) {
      return new Response(
        JSON.stringify({ success: true, skipped: 'unknown_type' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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
            .from('eitaa_links')
            .select('eitaa_user_id')
            .eq('profile_id', storeId)
            .maybeSingle();

          if (linkRec?.eitaa_user_id) {
            targetUserId = String(linkRec.eitaa_user_id).trim();
          }
        } catch (e) {
          console.warn('Failed to query eitaa_links:', e);
        }
      }

      if (!targetUserId) {
        return new Response(
          JSON.stringify({ success: true, skipped: 'no_link' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      let text = '';
      if (type === 'STORE_WELCOME') {
        if (approvalStatus === 'pending') {
          text = `✅ ثبتنام شما در بارفروش با موفقیت انجام شد.\n\nفروشگاه: ${name}\nوضعیت: در انتظار تأیید مدیریت\nپس از بررسی، نتیجه از همینجا به شما اطلاع داده میشود.`;
        } else {
          text = `✅ ثبتنام شما در بارفروش با موفقیت انجام شد.\n\nفروشگاه: ${name}\nهم‌اکنون میتوانید سفارش ثبت کنید.`;
        }
      } else if (type === 'STORE_APPROVED') {
        text = `🎉 ثبتنام فروشگاه ${name} تأیید شد. هم‌اکنون میتوانید در بارفروش سفارش ثبت کنید.`;
      } else if (type === 'STORE_REJECTED') {
        text = `❌ متأسفانه ثبتنام فروشگاه ${name} تأیید نشد.`;
        if (approvalNote) {
          text += `\n\nدلیل: ${approvalNote}`;
        }
        text += `\n\nبرای پیگیری با پشتیبانی تماس بگیرید.`;
      }

      if (!eitaaToken) {
        return new Response(
          JSON.stringify({ success: false, error: 'EITAA token not configured' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const eitaaUrl = eitaaToken.startsWith('bot')
        ? `https://eitaayar.ir/api/${eitaaToken}/sendMessage`
        : `https://eitaayar.ir/api/v1/${eitaaToken}/sendMessage`;

      try {
        const eitaaRes = await fetch(eitaaUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: targetUserId,
            text: text,
          }),
        });

        let eitaaJson: any = null;
        try {
          eitaaJson = await eitaaRes.json();
        } catch (parseErr) {
          console.error('Failed to parse Eitaayar response as JSON:', parseErr);
          eitaaJson = { ok: false, error: 'Invalid JSON response from Eitaayar' };
        }

        const isOk = Boolean(eitaaJson && eitaaJson.ok === true);
        if (!isOk) {
          console.error('Eitaa store status send failed:', eitaaJson);
        }

        return new Response(
          JSON.stringify({
            success: isOk,
            message: isOk ? 'پیام وضعیت فروشگاه ایتا ارسال شد.' : 'خطا در ارسال پیام ایتا',
            result: eitaaJson,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (err) {
        console.error('Eitaa store status fetch error:', err);
        return new Response(
          JSON.stringify({ success: true, error: String(err) }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Previous INSERT logic (unchanged)
    let storeTargetChatId =
      body.chat_id ||
      body.eitaa_chat_id ||
      body.target_chat_id ||
      '';

    let messageText = '';

    const isSupermarketEvent =
      body.table === 'supermarkets' ||
      body.type === 'store_registration' ||
      Boolean(body.store) ||
      (Boolean(body.name) && !body.order_id && !body.order && !body.table);

    if (isSupermarketEvent) {
      const rawStore = body.store || body.record || body;
      const storeId = rawStore.id;

      let s = {
        name: rawStore.name || rawStore.store_name || 'فروشگاه شما',
        owner: rawStore.owner || rawStore.owner_name || 'مدیر محترم',
        phone: rawStore.phone || rawStore.mobile || '',
        address: rawStore.address || '',
      };

      if (adminClient && storeId) {
        try {
          const { data: dbStore } = await adminClient
            .from('supermarkets')
            .select('id, name, owner, phone, address, eitaa_chat_id')
            .eq('id', storeId)
            .maybeSingle();

          if (dbStore) {
            s.name = dbStore.name || s.name;
            s.owner = dbStore.owner || s.owner;
            s.phone = dbStore.phone || s.phone;
            s.address = dbStore.address || s.address;
            if (!storeTargetChatId && dbStore.eitaa_chat_id) {
              storeTargetChatId = dbStore.eitaa_chat_id;
            }
          }
        } catch (e) {
          console.warn('Could not query store details from supermarkets:', e);
        }

        if (!storeTargetChatId) {
          try {
            const { data: prof } = await adminClient
              .from('profiles')
              .select('id, eitaa_chat_id')
              .eq('id', storeId)
              .maybeSingle();
            if (prof?.eitaa_chat_id) {
              storeTargetChatId = prof.eitaa_chat_id;
            }
          } catch (e) {
            console.warn('Could not query store eitaa_chat_id from profiles:', e);
          }
        }
      }

      messageText = `
🎉 سلام جناب/سرکار ${s.owner} عزیز

به سامانه پخش مواد غذایی و پروتئینی فرهودی خوش آمدید!
اطلاعات ثبت‌نام فروشگاه «${s.name}» با موفقیت دریافت و در سیستم ثبت گردید.

📞 شماره همراه: ${s.phone}
📍 آدرس: ${s.address || 'ثبت نشده'}

سفارشات، فاکتورها و وضعیت بارگیری از این طریق به اطلاع شما خواهد رسید.
`.trim();
    } else {
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
            .select('id, name, owner, phone, address, verification_type, eitaa_chat_id')
            .eq('id', supermarketId)
            .maybeSingle();

          if (dbStore) {
            s.name = dbStore.name || s.name;
            s.owner = dbStore.owner || s.owner;
            s.phone = dbStore.phone || s.phone;
            s.address = dbStore.address || s.address;
            s.verification_type = dbStore.verification_type || '';
            if (!storeTargetChatId && dbStore.eitaa_chat_id) {
              storeTargetChatId = dbStore.eitaa_chat_id;
            }
          }
        } catch (err) {
          console.warn('Failed to fetch supermarket in eitaa-notify-store:', err);
        }

        if (!storeTargetChatId) {
          try {
            const { data: prof } = await adminClient
              .from('profiles')
              .select('id, eitaa_chat_id')
              .eq('id', supermarketId)
              .maybeSingle();
            if (prof?.eitaa_chat_id) {
              storeTargetChatId = prof.eitaa_chat_id;
            }
          } catch (e) {
            console.warn('Could not query profile eitaa_chat_id:', e);
          }
        }
      }

      const isConsumer = s.verification_type === 'bulk_consumer';
      const orderDate = orderData.order_date
        ? new Date(orderData.order_date).toLocaleTimeString('fa-IR')
        : new Date().toLocaleTimeString('fa-IR');

      const fin = computeOrderFinancials(orderData, items, isConsumer);

      let itemsListText = '';
      if (items.length > 0) {
        const itemRows = items.map((it, idx) => {
          const qty = Number(it.quantity) || 0;
          const u = it.unit || 'عدد';
          const p = Number(it.items_per_package) > 1 ? Number(it.items_per_package) : 1;
          const unitPr = p > 1 ? Math.round(Number(it.price || 0) / p) : Number(it.price || 0);
          return `${idx + 1}. ${it.name || 'کالا'}: ${qty.toLocaleString('fa-IR')} ${u} (${unitPr.toLocaleString('fa-IR')} تومان)`;
        });
        itemsListText = `\n📦 اقلام ثبت‌شده:\n${itemRows.join('\n')}\n`;
      }

      const financialBlock = buildEitaaFinancialBlock(fin);

      messageText = `
🛒 سفارش شما با موفقیت ثبت شد

جناب/سرکار ${s.owner} (فروشگاه ${s.name})
سفارش شماره ${orderId || 'نامشخص'} با موفقیت در سیستم پخش ثبت گردید.

⏰ زمان ثبت: ${orderDate}
${itemsListText}
${financialBlock}

از حسن انتخاب و اعتماد شما سپاسگزاریم.
`.trim();
    }

    if (!eitaaToken) {
      return new Response(
        JSON.stringify({ success: false, message: 'EITAA token not configured' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!storeTargetChatId) {
      console.warn('Store has no linked eitaa_chat_id; skipped message delivery');
      return new Response(
        JSON.stringify({
          success: true,
          message: 'فروشگاه حساب ایتا متصل ندارد، اعلان ایتا ارسال نشد.',
          skipped: true,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const eitaaUrl = eitaaToken.startsWith('bot')
      ? `https://eitaayar.ir/api/${eitaaToken}/sendMessage`
      : `https://eitaayar.ir/api/v1/${eitaaToken}/sendMessage`;

    const eitaaRes = await fetch(eitaaUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: storeTargetChatId,
        text: messageText,
      }),
    });

    let eitaaJson: any = null;
    try {
      eitaaJson = await eitaaRes.json();
    } catch (parseErr) {
      console.error('Failed to parse Eitaayar response as JSON in eitaa-notify-store:', parseErr);
      eitaaJson = { ok: false, error: 'Invalid JSON response from Eitaayar' };
    }

    const isOk = Boolean(eitaaJson && eitaaJson.ok === true);
    if (!isOk) {
      console.error('Eitaa store send failed:', eitaaJson);
    }

    return new Response(
      JSON.stringify({
        success: isOk,
        message: isOk ? 'نوتیفیکیشن ایتا فروشگاه با موفقیت ارسال شد.' : 'خطا در ارسال پیام به ایتا',
        result: eitaaJson,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('eitaa-notify-store function error:', err);
    return new Response(
      JSON.stringify({
        success: false,
        error: err.message || 'خطای سرور در ارسال اعلان ایتا فروشگاه',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
