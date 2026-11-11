// @ts-nocheck
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

const ALLOWED_ORIGIN_REGEX =
  /^https:\/\/(www\.)?barfroosh\.ir$|^http:\/\/localhost(:\d+)?$|^http:\/\/127\.0\.0\.1(:\d+)?$|^https:\/\/[a-z0-9\-]+\.run\.app$/i;

function getCorsHeaders(req: Request) {
  const origin = req.headers.get('origin') || '';
  const isAllowed = ALLOWED_ORIGIN_REGEX.test(origin);
  const allowOrigin = isAllowed ? origin : 'https://barfroosh.ir';

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

// نقش‌های مجاز جهت اتصال حساب تلگرام
const ALLOWED_ROLES = ['admin', 'superadmin', 'visitor', 'warehouse', 'supermarket'];

function extractTelegramUser(initData: string): { id: string | number; username?: string; first_name?: string; last_name?: string } | null {
  try {
    if (!initData || typeof initData !== 'string') return null;
    const params = new URLSearchParams(initData);
    const userStr = params.get('user');
    if (!userStr) return null;
    return JSON.parse(userStr);
  } catch {
    return null;
  }
}

/**
 * تأیید امضای داده‌های دریافتی از تلگرام (HMAC-SHA256 بر اساس توکن بات)
 */
async function verifyTelegramSignature(initData: string, botToken: string): Promise<boolean> {
  try {
    if (!initData || !botToken) return true;
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) return false;

    const dataCheckArr: string[] = [];
    for (const [key, val] of params.entries()) {
      if (key !== 'hash') {
        dataCheckArr.push(`${key}=${val}`);
      }
    }
    dataCheckArr.sort();
    const dataCheckString = dataCheckArr.join('\n');

    const enc = new TextEncoder();
    // مرحله ۱: تولید کلید مخفی با HMAC روی رشته WebAppData با توکن بات
    const secretKeyMaterial = await crypto.subtle.importKey(
      'raw',
      enc.encode('WebAppData'),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const secretKeyBytes = await crypto.subtle.sign('HMAC', secretKeyMaterial, enc.encode(botToken));

    // مرحله ۲: محاسبه هش داده‌ها با کلید مخفی
    const hmacKey = await crypto.subtle.importKey(
      'raw',
      secretKeyBytes,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const calculatedSigBytes = await crypto.subtle.sign('HMAC', hmacKey, enc.encode(dataCheckString));
    const calculatedHash = Array.from(new Uint8Array(calculatedSigBytes))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    return calculatedHash.toLowerCase() === hash.toLowerCase();
  } catch (err) {
    console.warn('Telegram signature verification error:', err);
    return false;
  }
}

Deno.serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization') || '';
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'unauthorized', message: 'توکن ورود کاربر ارسال نشده است.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'server_configuration_error', message: 'تنظیمات سوپابیس کامل نیست.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // احراز هویت کاربر از طریق JWT
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'unauthorized', message: 'کاربر نامعتبر است یا نشست منقضی شده است.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json().catch(() => ({}));
    const initData = body.initData || '';
    const action = body.action || 'link';

    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // عملیات قطع اتصال (Unlink)
    if (action === 'unlink') {
      const { error: delErr } = await adminClient
        .from('telegram_links')
        .delete()
        .eq('profile_id', user.id);

      if (delErr) {
        console.error('Failed to unlink telegram account:', delErr);
        return new Response(
          JSON.stringify({ success: false, error: delErr.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, action: 'unlinked', message: 'اتصال حساب تلگرام لغو شد.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // بررسی نقش کاربر: تمام نقش‌های admin، superadmin، visitor، warehouse و supermarket مجاز به اتصال هستند
    const { data: userProfile } = await adminClient
      .from('profiles')
      .select('id, role')
      .eq('id', user.id)
      .maybeSingle();

    const currentRole = userProfile?.role || user.user_metadata?.role;
    if (!currentRole || !ALLOWED_ROLES.includes(currentRole)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'forbidden_role',
          message: 'نقش کاربری شما مجاز به اتصال به پیام‌رسان تلگرام نیست.',
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // تأیید امضای داده‌های ورودی تلگرام (در صورت تنظیم توکن بات)
    let tgBotToken = Deno.env.get('TELEGRAM_BOT_TOKEN') || '';
    if (!tgBotToken) {
      try {
        const { data: sRec } = await adminClient
          .from('app_settings')
          .select('value')
          .eq('key', 'telegram_bot_token')
          .maybeSingle();
        if (sRec?.value) {
          tgBotToken = typeof sRec.value === 'string' ? sRec.value.replace(/"/g, '') : String(sRec.value);
        }
      } catch {}
    }

    if (tgBotToken) {
      const isSignatureValid = await verifyTelegramSignature(initData, tgBotToken);
      if (!isSignatureValid) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'invalid_signature',
            message: 'امضای داده‌های تلگرام نامعتبر است.',
          }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // استخراج مشخصات حساب کاربری تلگرام
    const tgUser = extractTelegramUser(initData);
    if (!tgUser || tgUser.id === undefined || tgUser.id === null) {
      return new Response(
        JSON.stringify({ success: false, error: 'missing_telegram_user', message: 'اطلاعات حساب تلگرام یافت نشد.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tgUserId = String(tgUser.id).trim();

    // ۱. بررسی شرط عدم اتصال همزمان یک حساب تلگرام به دو پروفایل مختلف
    const { data: existingLink, error: queryErr } = await adminClient
      .from('telegram_links')
      .select('profile_id, telegram_user_id')
      .eq('telegram_user_id', tgUserId)
      .maybeSingle();

    if (queryErr) {
      console.warn('Query existing telegram_links error:', queryErr);
    }

    if (existingLink && existingLink.profile_id && String(existingLink.profile_id) !== String(user.id)) {
      // این حساب تلگرام قبلاً به پروفایل دیگری متصل شده است
      return new Response(
        JSON.stringify({
          success: false,
          error: 'already_linked_to_other_profile',
          message: 'این حساب تلگرام قبلاً به پروفایل کاربری دیگری متصل شده است و نمی‌تواند همزمان به دو حساب متصل باشد.',
          linked_profile_id: existingLink.profile_id,
        }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ۲. درج یا به‌روزرسانی اتصال برای کاربر جاری (ادمین، سوپرادمین، ویزیتور، انباردار و فروشگاه)
    const { error: upsertErr } = await adminClient
      .from('telegram_links')
      .upsert(
        {
          profile_id: user.id,
          telegram_user_id: tgUserId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'profile_id' }
      );

    if (upsertErr) {
      console.error('Failed to upsert telegram_links:', upsertErr);
      return new Response(
        JSON.stringify({ success: false, error: upsertErr.message, message: 'خطا در ذخیره اطلاعات اتصال تلگرام' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'اتصال حساب تلگرام با موفقیت انجام شد.',
        profile_id: user.id,
        telegram_user_id: tgUserId,
        role: currentRole,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('telegram-link error:', err);
    return new Response(
      JSON.stringify({ success: false, error: String(err?.message || err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
