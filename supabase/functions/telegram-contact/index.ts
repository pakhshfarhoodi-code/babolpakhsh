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

Deno.serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization') || '';
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'unauthorized', message: 'توکن کاربر ارسال نشده است.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'server_configuration_error' }),
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
        JSON.stringify({ success: false, error: 'unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json().catch(() => ({}));
    const initData = body.initData || '';
    const mode = body.mode || '';

    const tgUser = extractTelegramUser(initData);
    if (!tgUser || tgUser.id === undefined || tgUser.id === null) {
      return new Response(
        JSON.stringify({ success: false, error: 'missing_telegram_user' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tgUserId = String(tgUser.id).trim();

    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 1. بررسی رکورد اتصال این کاربر در telegram_links
    const { data: userLink } = await adminClient
      .from('telegram_links')
      .select('profile_id, telegram_user_id')
      .eq('profile_id', user.id)
      .maybeSingle();

    // 2. حالت verify (بررسی تطابق نشست جاری با اکانت تلگرام فعال)
    if (mode === 'verify') {
      if (userLink) {
        if (String(userLink.telegram_user_id) === tgUserId) {
          return new Response(
            JSON.stringify({ success: true, match: true }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } else {
          // حساب متصل متعلق به این کاربر با حساب تلگرامی که هم‌اکنون مینی‌اپ را باز کرده مغایرت دارد
          return new Response(
            JSON.stringify({ success: false, error: 'mismatch', message: 'حساب تلگرام با این نشست همخوانی ندارد.' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      // اگر این کاربر هنوز اتصالی در telegram_links ندارد:
      // بررسی می‌کنیم آیا این اکانت تلگرام متعلق به پروفایل دیگری است یا خیر
      const { data: otherLink } = await adminClient
        .from('telegram_links')
        .select('profile_id, telegram_user_id')
        .eq('telegram_user_id', tgUserId)
        .maybeSingle();

      if (otherLink && String(otherLink.profile_id) !== String(user.id)) {
        return new Response(
          JSON.stringify({ success: false, error: 'mismatch', message: 'این حساب تلگرام قبلاً به حساب دیگری متصل شده است.' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // اکانت تلگرام آزاد است؛ اتصال برای این پروفایل برقرار می‌شود
      await adminClient
        .from('telegram_links')
        .upsert(
          {
            profile_id: user.id,
            telegram_user_id: tgUserId,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'profile_id' }
        );

      return new Response(
        JSON.stringify({ success: true, match: true, auto_linked: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. حالت پیش‌فرض (همگام‌سازی و اتصال)
    // بررسی عدم اتصال اکانت تلگرام به پروفایل دیگر
    const { data: conflictLink } = await adminClient
      .from('telegram_links')
      .select('profile_id, telegram_user_id')
      .eq('telegram_user_id', tgUserId)
      .maybeSingle();

    if (conflictLink && String(conflictLink.profile_id) !== String(user.id)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'already_linked_to_other_profile',
          message: 'این حساب تلگرام قبلاً به پروفایل دیگری متصل شده است.',
        }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    await adminClient
      .from('telegram_links')
      .upsert(
        {
          profile_id: user.id,
          telegram_user_id: tgUserId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'profile_id' }
      );

    return new Response(
      JSON.stringify({ success: true, message: 'مخاطب تلگرام با موفقیت بررسی و متصل شد.' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('telegram-contact error:', err);
    return new Response(
      JSON.stringify({ success: false, error: String(err?.message || err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
