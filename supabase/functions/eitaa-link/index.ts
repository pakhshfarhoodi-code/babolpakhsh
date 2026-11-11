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

// نقش‌های مجاز جهت اتصال حساب ایتا: تمام نقش‌های کلیدی سامانه
const ALLOWED_ROLES = ['admin', 'superadmin', 'visitor', 'warehouse', 'supermarket'];

function extractEitaaUser(initData: any): { id: string | number; username?: string; name?: string } | null {
  try {
    if (!initData) return null;
    if (typeof initData === 'object' && initData !== null) {
      if (initData.user && typeof initData.user === 'object') return initData.user;
      if (initData.id) return initData;
    }
    if (typeof initData === 'string') {
      const trimmed = initData.trim();
      if (trimmed.startsWith('{')) {
        const parsed = JSON.parse(trimmed);
        return parsed.user || parsed;
      }
      const params = new URLSearchParams(trimmed);
      const userStr = params.get('user');
      if (userStr) return JSON.parse(userStr);
      const idStr = params.get('id');
      if (idStr) return { id: idStr };
    }
  } catch {}
  return null;
}

/**
 * تأیید امضای داده‌های دریافتی از ایتا (در صورت ارسال پارامتر hash و پیکربندی توکن بات)
 */
async function verifyEitaaSignature(initData: string, botToken: string): Promise<boolean> {
  try {
    if (!initData || !botToken || typeof initData !== 'string') return true;
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) return true; // در صورتی که کلاینت ایتا هنوز هش امضا نفرستاده باشد، فرآیند مسدود نشود

    const dataCheckArr: string[] = [];
    for (const [key, val] of params.entries()) {
      if (key !== 'hash') {
        dataCheckArr.push(`${key}=${val}`);
      }
    }
    dataCheckArr.sort();
    const dataCheckString = dataCheckArr.join('\n');

    const enc = new TextEncoder();
    const secretKeyMaterial = await crypto.subtle.importKey(
      'raw',
      enc.encode('WebAppData'),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const secretKeyBytes = await crypto.subtle.sign('HMAC', secretKeyMaterial, enc.encode(botToken));

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
    console.warn('Eitaa signature verification error:', err);
    return true;
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
        .from('eitaa_links')
        .delete()
        .eq('profile_id', user.id);

      if (delErr) {
        console.error('Failed to unlink eitaa account:', delErr);
        return new Response(
          JSON.stringify({ success: false, error: delErr.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, action: 'unlinked', message: 'اتصال حساب ایتا لغو شد.' }),
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
          message: 'نقش کاربری شما مجاز به اتصال به پیام‌رسان ایتا نیست.',
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // تأیید امضای داده‌های ورودی ایتا (در صورت ارسال امضا و تنظیم بودن توکن)
    let eitaaToken = Deno.env.get('EITAA_BOT_TOKEN') || Deno.env.get('EITAAYAR_TOKEN') || '';
    if (!eitaaToken) {
      try {
        const { data: sRec } = await adminClient
          .from('app_settings')
          .select('value')
          .in('key', ['eitaa_bot_token', 'eitaayar_token'])
          .maybeSingle();
        if (sRec?.value) {
          eitaaToken = typeof sRec.value === 'string' ? sRec.value.replace(/"/g, '') : String(sRec.value);
        }
      } catch {}
    }

    if (eitaaToken && typeof initData === 'string' && initData.includes('hash=')) {
      const isSignatureValid = await verifyEitaaSignature(initData, eitaaToken);
      if (!isSignatureValid) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'invalid_signature',
            message: 'امضای داده‌های ایتا نامعتبر است.',
          }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // استخراج مشخصات حساب کاربری ایتا
    const eitaaUser = extractEitaaUser(initData);
    if (!eitaaUser || eitaaUser.id === undefined || eitaaUser.id === null) {
      return new Response(
        JSON.stringify({ success: false, error: 'missing_eitaa_user', message: 'اطلاعات حساب ایتا یافت نشد.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const eitaaUserId = String(eitaaUser.id).trim();

    // ۱. بررسی شرط عدم اتصال همزمان یک حساب ایتا به دو پروفایل مختلف
    const { data: existingLink, error: queryErr } = await adminClient
      .from('eitaa_links')
      .select('profile_id, eitaa_user_id')
      .eq('eitaa_user_id', eitaaUserId)
      .maybeSingle();

    if (queryErr) {
      console.warn('Query existing eitaa_links error:', queryErr);
    }

    if (existingLink && existingLink.profile_id && String(existingLink.profile_id) !== String(user.id)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'already_linked_to_other_profile',
          message: 'این حساب ایتا قبلاً به پروفایل کاربری دیگری متصل شده است و نمی‌تواند همزمان به دو حساب متصل باشد.',
          linked_profile_id: existingLink.profile_id,
        }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ۲. درج یا به‌روزرسانی اتصال برای کاربر جاری (ادمین، سوپرادمین، ویزیتور، انباردار و فروشگاه)
    const { error: upsertErr } = await adminClient
      .from('eitaa_links')
      .upsert(
        {
          profile_id: user.id,
          eitaa_user_id: eitaaUserId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'profile_id' }
      );

    if (upsertErr) {
      console.error('Failed to upsert eitaa_links:', upsertErr);
      return new Response(
        JSON.stringify({ success: false, error: upsertErr.message, message: 'خطا در ذخیره اطلاعات اتصال ایتا' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'اتصال حساب ایتا با موفقیت انجام شد.',
        profile_id: user.id,
        eitaa_user_id: eitaaUserId,
        role: currentRole,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('eitaa-link error:', err);
    return new Response(
      JSON.stringify({ success: false, error: String(err?.message || err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
