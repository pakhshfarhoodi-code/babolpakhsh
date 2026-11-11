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

    // Handle Unlink
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

    // Handle Link
    const eitaaUser = extractEitaaUser(initData);
    if (!eitaaUser || eitaaUser.id === undefined || eitaaUser.id === null) {
      return new Response(
        JSON.stringify({ success: false, error: 'missing_eitaa_user', message: 'اطلاعات حساب ایتا یافت نشد.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const eitaaUserId = String(eitaaUser.id).trim();

    // 1. بررسی شرط عدم اتصال همزمان یک حساب ایتا به دو پروفایل مختلف
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

    // 2. درج یا به‌روزرسانی اتصال برای کاربر جاری (پشتیبانی از تمام نقش‌ها: ادمین، سوپرادمین، ویزیتور، انبار، فروشگاه)
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
