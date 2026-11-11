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

    const eitaaUser = extractEitaaUser(initData);
    if (!eitaaUser || eitaaUser.id === undefined || eitaaUser.id === null) {
      return new Response(
        JSON.stringify({ success: false, error: 'missing_eitaa_user' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const eitaaUserId = String(eitaaUser.id).trim();

    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 1. بررسی رکورد اتصال این کاربر در eitaa_links
    const { data: userLink } = await adminClient
      .from('eitaa_links')
      .select('profile_id, eitaa_user_id')
      .eq('profile_id', user.id)
      .maybeSingle();

    // 2. حالت verify (بررسی تطابق نشست جاری با اکانت ایتا فعال)
    if (mode === 'verify') {
      if (userLink) {
        if (String(userLink.eitaa_user_id) === eitaaUserId) {
          return new Response(
            JSON.stringify({ success: true, match: true }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } else {
          return new Response(
            JSON.stringify({ success: false, error: 'mismatch', message: 'حساب ایتا با این نشست همخوانی ندارد.' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      // اگر کاربر هنوز اتصالی در eitaa_links ندارد:
      // بررسی می‌کنیم آیا این اکانت ایتا متعلق به پروفایل دیگری است یا خیر
      const { data: otherLink } = await adminClient
        .from('eitaa_links')
        .select('profile_id, eitaa_user_id')
        .eq('eitaa_user_id', eitaaUserId)
        .maybeSingle();

      if (otherLink && String(otherLink.profile_id) !== String(user.id)) {
        return new Response(
          JSON.stringify({ success: false, error: 'mismatch', message: 'این حساب ایتا قبلاً به حساب دیگری متصل شده است.' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // اکانت ایتا آزاد است؛ اتصال برای این پروفایل برقرار می‌شود
      await adminClient
        .from('eitaa_links')
        .upsert(
          {
            profile_id: user.id,
            eitaa_user_id: eitaaUserId,
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
    // بررسی عدم اتصال اکانت ایتا به پروفایل دیگر
    const { data: conflictLink } = await adminClient
      .from('eitaa_links')
      .select('profile_id, eitaa_user_id')
      .eq('eitaa_user_id', eitaaUserId)
      .maybeSingle();

    if (conflictLink && String(conflictLink.profile_id) !== String(user.id)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'already_linked_to_other_profile',
          message: 'این حساب ایتا قبلاً به پروفایل دیگری متصل شده است.',
        }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    await adminClient
      .from('eitaa_links')
      .upsert(
        {
          profile_id: user.id,
          eitaa_user_id: eitaaUserId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'profile_id' }
      );

    return new Response(
      JSON.stringify({ success: true, message: 'مخاطب ایتا با موفقیت بررسی و متصل شد.' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('eitaa-contact error:', err);
    return new Response(
      JSON.stringify({ success: false, error: String(err?.message || err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
