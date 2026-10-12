// @ts-nocheck
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// HTML escape helper for safe Telegram HTML formatting
function escapeHtml(text: string = ''): string {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceRoleKey =
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ||
      Deno.env.get('SERVICE_ROLE_KEY') ||
      '';

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    // Initialize Supabase admin client to read settings if needed
    let adminClient: any = null;
    if (supabaseUrl && supabaseServiceRoleKey) {
      adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
    }

    // Resolve Telegram and Eitaa credentials from env or app_settings table
    let tgBotToken = Deno.env.get('TELEGRAM_BOT_TOKEN') || '';
    let tgChatId = Deno.env.get('TELEGRAM_ADMIN_CHAT_ID') || '';
    let eitaaToken = Deno.env.get('EITAA_BOT_TOKEN') || Deno.env.get('EITAAYAR_TOKEN') || '';
    let eitaaChatId = Deno.env.get('EITAA_ADMIN_CHAT_ID') || '';

    if (adminClient && (!tgBotToken || !tgChatId || !eitaaToken || !eitaaChatId)) {
      try {
        const { data: settings } = await adminClient
          .from('app_settings')
          .select('key, value')
          .in('key', ['bot_notifications', 'telegram_bot_token', 'telegram_admin_chat_id', 'eitaa_bot_token', 'eitaa_admin_chat_id']);

        if (settings && Array.isArray(settings)) {
          for (const s of settings) {
            if (s.key === 'bot_notifications' && typeof s.value === 'object' && s.value !== null) {
              tgBotToken = tgBotToken || s.value.telegram_bot_token || '';
              tgChatId = tgChatId || s.value.telegram_admin_chat_id || '';
              eitaaToken = eitaaToken || s.value.eitaa_bot_token || s.value.eitaayar_token || '';
              eitaaChatId = eitaaChatId || s.value.eitaa_admin_chat_id || '';
            }
            if (s.key === 'telegram_bot_token') tgBotToken = tgBotToken || String(s.value);
            if (s.key === 'telegram_admin_chat_id') tgChatId = tgChatId || String(s.value);
            if (s.key === 'eitaa_bot_token') eitaaToken = eitaaToken || String(s.value);
            if (s.key === 'eitaa_admin_chat_id') eitaaChatId = eitaaChatId || String(s.value);
          }
        }
      } catch (e) {
        console.warn('Failed to load bot credentials from app_settings:', e);
      }
    }

    // Determine event type: Direct invocation OR Supabase Database Webhook
    // Case 1: Database Webhook format: { type: 'INSERT', table: 'supermarkets', record: { ... } }
    // Case 2: Client payload format: { type: 'store_registration', store: { ... } }
    let eventType = body.type;
    let storeData = body.store || body.record;

    if (body.table === 'supermarkets' && body.type === 'INSERT') {
      eventType = 'store_registration';
      storeData = body.record;
    }

    if (!storeData && body.name) {
      storeData = body;
    }

    const storeName = storeData?.name || 'فروشگاه جدید';
    const storeOwner = storeData?.owner || 'متصدی فروشگاه';
    const storePhone = storeData?.phone || '';
    const storeAddress = storeData?.address || 'ثبت نشده';
    const regSource = storeData?.registration_source || 'مستقیم از وب‌سایت';

    // Build Persian message for Telegram (HTML Mode to avoid any Markdown entity parse errors)
    const telegramHtmlMessage = `
🛒 <b>ثبت‌نام فروشگاه جدید در سامانه پخش فرهودی</b>

🏪 <b>نام فروشگاه:</b> ${escapeHtml(storeName)}
👤 <b>مدیر / صاحب فروشگاه:</b> ${escapeHtml(storeOwner)}
📞 <b>شماره همراه:</b> <code>${escapeHtml(storePhone)}</code>
📍 <b>آدرس:</b> ${escapeHtml(storeAddress)}
🌐 <b>مبدأ ثبت‌نام:</b> ${escapeHtml(regSource)}
⏰ <b>زمان ثبت:</b> ${new Date().toLocaleTimeString('fa-IR')}
`.trim();

    // Plain text message for Eitaa
    const eitaaTextMessage = `
🛒 ثبت‌نام فروشگاه جدید در سامانه پخش فرهودی

🏪 نام فروشگاه: ${storeName}
👤 مدیر / متصدی: ${storeOwner}
📞 شماره همراه: ${storePhone}
📍 آدرس: ${storeAddress}
🌐 مبدأ ثبت‌نام: ${regSource}
⏰ زمان: ${new Date().toLocaleTimeString('fa-IR')}
`.trim();

    const results: { telegram?: any; eitaa?: any } = {};

    // 1. Send to Telegram Admin
    if (tgBotToken && tgChatId) {
      try {
        const tgRes = await fetch(`https://api.telegram.org/bot${tgBotToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: tgChatId,
            text: telegramHtmlMessage,
            parse_mode: 'HTML',
          }),
        });
        const tgJson = await tgRes.json();
        results.telegram = tgJson;
        if (!tgJson.ok) {
          console.warn('Telegram send failed:', tgJson);
        }
      } catch (err) {
        console.error('Telegram fetch error:', err);
        results.telegram = { ok: false, error: String(err) };
      }
    } else {
      results.telegram = { ok: false, message: 'TELEGRAM_BOT_TOKEN or TELEGRAM_ADMIN_CHAT_ID not configured' };
    }

    // 2. Send to Eitaa Admin (supports eitaayar API or direct eitaa API)
    if (eitaaToken && eitaaChatId) {
      try {
        const eitaaUrl = eitaaToken.startsWith('bot')
          ? `https://eitaayar.ir/api/${eitaaToken}/sendMessage`
          : `https://eitaayar.ir/api/v1/${eitaaToken}/sendMessage`;

        const eitaaRes = await fetch(eitaaUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: eitaaChatId,
            text: eitaaTextMessage,
          }),
        });
        const eitaaJson = await eitaaRes.json();
        results.eitaa = eitaaJson;
      } catch (err) {
        console.error('Eitaa fetch error:', err);
        results.eitaa = { ok: false, error: String(err) };
      }
    } else {
      results.eitaa = { ok: false, message: 'EITAA credentials not configured' };
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'نوتیفیکیشن با موفقیت پردازش شد.',
        results,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (err: any) {
    console.error('notify-admin function error:', err);
    return new Response(
      JSON.stringify({
        success: false,
        error: err.message || 'خطای سرور در ارسال نوتیفیکیشن',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
