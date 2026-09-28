// @ts-nocheck
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req: Request) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'پیکربندی سرور ناقص است. کلید دسترسی سیستمی (service_role) یافت نشد.',
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 1. Authenticate the caller using their JWT from Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'توکن دسترسی معتبر ارسال نشده است. لطفاً مجدداً وارد شوید.',
        }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const callerClient = createClient(supabaseUrl, supabaseAnonKey || supabaseServiceRoleKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });

    const {
      data: { user: callerUser },
      error: callerAuthError,
    } = await callerClient.auth.getUser();

    if (callerAuthError || !callerUser) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'هویت کاربر فراخواننده احراز نشد یا توکن منقضی شده است.',
        }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 2. Client with service_role to check role and execute administrative tasks
    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: callerProfile, error: profileCheckError } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', callerUser.id)
      .single();

    if (
      profileCheckError ||
      !callerProfile ||
      !['admin', 'superadmin'].includes(callerProfile.role)
    ) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'دسترسی غیرمجاز: تنها مدیران سیستم (admin) مجاز به ساخت حساب پرسنل هستند.',
        }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 3. Parse and validate JSON request body
    let body: {
      name?: string;
      phone?: string;
      role?: 'warehouse' | 'visitor';
      region?: string;
      username?: string;
      password?: string;
    };

    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: 'قالب بدنه درخواست نامعتبر است (JSON مورد نیاز است).' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { name, phone, role, region, username, password } = body;

    if (!name?.trim() || !phone?.trim() || !role || !username?.trim() || !password) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'تکمیل تمامی فیلدهای الزامی (نام، موبایل، نقش، نام کاربری و رمز عبور) ضروری است.',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (role !== 'warehouse' && role !== 'visitor') {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'نقش انتخابی باید انباردار (warehouse) یا ویزیتور (visitor) باشد.',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (password.length < 6) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'رمز عبور باید حداقل شامل ۶ کاراکتر باشد.',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const cleanUsername = username.trim().toLowerCase();
    const cleanPhone = phone.trim();
    const cleanName = name.trim();
    const cleanRegion = (region || '').trim();

    // 4. Construct synthetic email: ${username.toLowerCase()}@babolpakhsh.internal
    const email = `${cleanUsername}@babolpakhsh.internal`;

    // 5. Create user in Supabase Auth via adminClient
    const { data: createdUserData, error: createAuthError } =
      await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          name: cleanName,
          role,
          username: cleanUsername,
        },
      });

    if (createAuthError) {
      const errMsg = (createAuthError.message || '').toLowerCase();
      if (
        errMsg.includes('already') ||
        errMsg.includes('registered') ||
        errMsg.includes('exists')
      ) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'این نام کاربری قبلاً استفاده شده است. لطفاً نام کاربری دیگری انتخاب کنید.',
          }),
          {
            status: 409,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      return new Response(
        JSON.stringify({
          success: false,
          error: `خطا در ایجاد کاربر احراز هویت: ${createAuthError.message}`,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const newUserId = createdUserData.user.id;

    // 6. Insert profile record with username & password
    const { error: profileInsertError } = await adminClient.from('profiles').upsert({
      id: newUserId,
      name: cleanName,
      role,
      phone: cleanPhone,
      username: cleanUsername,
      password: password,
    });

    if (profileInsertError) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `خطا در ثبت جدول پروفایل: ${profileInsertError.message}`,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 7. If role is visitor, also insert into visitors table
    if (role === 'visitor') {
      const { error: visitorInsertError } = await adminClient.from('visitors').upsert({
        id: newUserId,
        name: cleanName,
        phone: cleanPhone,
        region: cleanRegion || 'منطقه نامشخص',
        username: cleanUsername,
        password: password,
        is_active: true,
      });

      if (visitorInsertError) {
        return new Response(
          JSON.stringify({
            success: false,
            error: `خطا در ثبت جدول ویزیتورها: ${visitorInsertError.message}`,
          }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    }

    // 8. Return success response
    return new Response(
      JSON.stringify({
        success: true,
        userId: newUserId,
        username: cleanUsername,
        role,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'خطای سرور در پردازش درخواست';
    return new Response(
      JSON.stringify({
        success: false,
        error: `خطای پیش‌بینی نشده: ${message}`,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
