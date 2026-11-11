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

    // Authenticate the user from JWT
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

    // Handle Unlink
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

    // Handle Link
    const tgUser = extractTelegramUser(initData);
    if (!tgUser || tgUser.id === undefined || tgUser.id === null) {
      return new Response(
        JSON.stringify({ success: false, error: 'missing_telegram_user', message: 'اطلاعات حساب تلگرام یافت نشد.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tgUserId = String(tgUser.id).trim();

    // 1. بررسی شرط عدم اتصال همزمان یک حساب تلگرام به دو پروفایل مختلف
    const { data: existingLink, error: queryErr } = await adminClient
      .from('telegram_links')
      .select('profile_id, telegram_user_id')
      .eq('telegram_user_id', tgUserId)
      .maybeSingle();

    if (queryErr) {
      console.warn('Query existing telegram_links error:', queryErr);
    }

    if (existingLink && existingLink.profile_id && String(existingLink.profile_id) !== String(user.id)) {
      // حساب تلگرام قبلاً به پروفایل دیگری متصل شده است
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

    // 2. درج یا به‌روزرسانی اتصال برای کاربر جاری (پشتیبانی از تمام نقش‌ها: ادمین، سوپرادمین، ویزیتور، انبار، فروشگاه)
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
