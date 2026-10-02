// @ts-nocheck
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Self-contained phone normalizer for Iranian mobile numbers
const normalizePhone = (str: string): string => {
  if (!str) return '';
  const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  let clean = String(str).trim();
  for (let i = 0; i < 10; i++) {
    clean = clean.split(persianDigits[i]).join(String(i));
    clean = clean.split(arabicDigits[i]).join(String(i));
  }
  clean = clean.replace(/\D/g, '');
  if (clean.startsWith('0098')) {
    clean = '0' + clean.slice(4);
  } else if (clean.startsWith('98') && clean.length >= 12) {
    clean = '0' + clean.slice(2);
  } else if (clean.startsWith('9') && clean.length === 10) {
    clean = '0' + clean;
  }
  return clean;
};

const isValidMobile = (str: string): boolean => {
  const normalized = normalizePhone(str);
  return /^09\d{9}$/.test(normalized);
};

const MIN_PASSWORD_LENGTH = 6;

Deno.serve(async (req: Request) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const supabaseServiceRoleKey =
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SERVICE_ROLE_KEY');

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
      .select('id, role')
      .eq('id', callerUser.id)
      .single();

    if (profileCheckError || !callerProfile) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'پروفایل کاربر فراخواننده یافت نشد یا دسترسی غیرمجاز است.',
        }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const callerRole = callerProfile.role;
    const isAdmin = callerRole === 'admin' || callerRole === 'superadmin';
    const isVisitor = callerRole === 'visitor';

    // 3. Parse and validate JSON request body
    let body: {
      action?: 'create_staff' | 'create' | 'create_store' | 'reset_password' | 'change_phone' | 'delete_account';
      userId?: string;
      name?: string;
      owner?: string;
      phone?: string;
      newPhone?: string;
      address?: string;
      role?: 'warehouse' | 'visitor';
      region?: string;
      assigned_visitor_id?: string;
      password?: string;
    };

    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'قالب بدنه درخواست نامعتبر است (JSON مورد نیاز است).',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const action = body.action || 'create_staff';

    // =========================================================================
    // ACTION 1: reset_password (Admin Only)
    // =========================================================================
    if (action === 'reset_password') {
      if (!isAdmin) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'تنها مدیران سیستم مجاز به بازنشانی رمز عبور هستند.',
          }),
          {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      const { userId, password = '123456' } = body;
      if (!userId) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'شناسه کاربر الزامی است.',
          }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      if (password.length < MIN_PASSWORD_LENGTH) {
        return new Response(
          JSON.stringify({
            success: false,
            error: `رمز عبور باید حداقل شامل ${MIN_PASSWORD_LENGTH} کاراکتر باشد.`,
          }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      // Update password directly in Supabase Auth (clean password, no suffix)
      const { error: updateAuthError } = await adminClient.auth.admin.updateUserById(userId, {
        password: password,
      });

      if (updateAuthError) {
        return new Response(
          JSON.stringify({
            success: false,
            error: `خطا در بازنشانی رمز در احراز هویت: ${updateAuthError.message}`,
          }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: 'رمز عبور کاربر با موفقیت بازنشانی شد.',
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // =========================================================================
    // ACTION 2: change_phone (Admin Only)
    // =========================================================================
    if (action === 'change_phone') {
      if (!isAdmin) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'تنها مدیران سیستم مجاز به تغییر شماره کاربری هستند.',
          }),
          {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      const userId = body.userId;
      const targetPhone = body.newPhone || body.phone;

      if (!userId || !targetPhone) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'شناسه کاربر و شماره موبایل جدید الزامی است.',
          }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      const cleanNewPhone = normalizePhone(targetPhone);
      if (!isValidMobile(cleanNewPhone)) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'شماره موبایل وارد شده نامعتبر است.',
          }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      // Check uniqueness in profiles
      const { data: dupProfile } = await adminClient
        .from('profiles')
        .select('id')
        .eq('phone', cleanNewPhone)
        .neq('id', userId)
        .maybeSingle();

      if (dupProfile) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'این شماره قبلاً ثبت شده است.',
          }),
          {
            status: 409,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      const newEmail = `${cleanNewPhone}@babolpakhsh.internal`;

      // 1. Update in Supabase Auth
      const { error: updateAuthErr } = await adminClient.auth.admin.updateUserById(userId, {
        email: newEmail,
      });

      if (updateAuthErr) {
        return new Response(
          JSON.stringify({
            success: false,
            error: `خطا در بروزرسانی ایمیل احراز هویت: ${updateAuthErr.message}`,
          }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      // 2. Update in profiles table
      await adminClient
        .from('profiles')
        .update({ phone: cleanNewPhone, username: cleanNewPhone })
        .eq('id', userId);

      // 3. Update in supermarkets table if exists
      await adminClient
        .from('supermarkets')
        .update({ phone: cleanNewPhone, username: cleanNewPhone })
        .eq('id', userId);

      // 4. Update in visitors table if exists
      await adminClient
        .from('visitors')
        .update({ phone: cleanNewPhone, username: cleanNewPhone })
        .eq('id', userId);

      return new Response(
        JSON.stringify({
          success: true,
          message: 'شماره تماس و مشخصات ورود کاربر با موفقیت تغییر یافت.',
          newPhone: cleanNewPhone,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // =========================================================================
    // ACTION 3: delete_account (Admin Only - Preserving orders)
    // =========================================================================
    if (action === 'delete_account') {
      if (!isAdmin) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'تنها مدیران سیستم مجاز به حذف حساب کاربری هستند.',
          }),
          {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      const userId = body.userId;
      if (!userId) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'شناسه کاربر جهت حذف الزامی است.',
          }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      // 1. Unlink in orders (NEVER delete orders)
      await adminClient
        .from('orders')
        .update({ supermarket_id: null })
        .eq('supermarket_id', userId);

      await adminClient
        .from('orders')
        .update({ assigned_visitor_id: null })
        .eq('assigned_visitor_id', userId);

      // 2. Unlink in supermarkets assigned to this visitor
      await adminClient
        .from('supermarkets')
        .update({ assigned_visitor_id: null })
        .eq('assigned_visitor_id', userId);

      // 3. Unlink in loading_bills and other auxiliary tables
      await adminClient.from('loading_bills').update({ visitor_id: null }).eq('visitor_id', userId);
      await adminClient.from('order_visitor_history').update({ new_visitor_id: null }).eq('new_visitor_id', userId);
      await adminClient.from('order_visitor_history').update({ old_visitor_id: null }).eq('old_visitor_id', userId);
      await adminClient.from('reassignment_requests').delete().or(`from_visitor_id.eq.${userId},to_visitor_id.eq.${userId}`);

      // 4. Delete from supermarkets and visitors
      await adminClient.from('supermarkets').delete().eq('id', userId);
      await adminClient.from('visitors').delete().eq('id', userId);

      // 5. Delete from profiles
      const { error: delProfileErr } = await adminClient.from('profiles').delete().eq('id', userId);
      if (delProfileErr) {
        console.warn('Profile delete warning:', delProfileErr.message);
      }

      // 6. Delete from Supabase Auth
      const { error: delAuthErr } = await adminClient.auth.admin.deleteUser(userId);
      if (delAuthErr) {
        console.warn('Auth user delete warning:', delAuthErr.message);
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: 'حساب کاربری با موفقیت حذف گردید.',
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // =========================================================================
    // ACTION 4: create_store (Admin or Visitor)
    // =========================================================================
    if (action === 'create_store') {
      if (!isAdmin && !isVisitor) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'تنها مدیران سیستم و ویزیتورها مجاز به ثبت فروشگاه هستند.',
          }),
          {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      const { name, owner = '', phone, address = '', password } = body;
      let assigned_visitor_id = body.assigned_visitor_id;

      if (!name?.trim() || !phone?.trim() || !password) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'نام فروشگاه، شماره موبایل و رمز عبور الزامی است.',
          }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      const cleanPhone = normalizePhone(phone);
      if (!isValidMobile(cleanPhone)) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'شماره موبایل معتبر وارد کنید (نمونه: ۰۹۱۲۳۴۵۶۷۸۹).',
          }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      if (password.length < MIN_PASSWORD_LENGTH) {
        return new Response(
          JSON.stringify({
            success: false,
            error: `رمز عبور باید حداقل ${MIN_PASSWORD_LENGTH} کاراکتر باشد.`,
          }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      // If caller is visitor, assigned_visitor_id is locked to caller
      if (isVisitor) {
        assigned_visitor_id = callerUser.id;
      }

      // Check phone uniqueness across profiles
      const { data: existingProfile } = await adminClient
        .from('profiles')
        .select('id')
        .eq('phone', cleanPhone)
        .maybeSingle();

      if (existingProfile) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'این شماره قبلاً ثبت شده است.',
          }),
          {
            status: 409,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      const cleanName = name.trim();
      const cleanOwner = (owner || '').trim();
      const cleanAddress = (address || '').trim();
      const email = `${cleanPhone}@babolpakhsh.internal`;

      // Create user in Supabase Auth (no role in metadata)
      const { data: createdUserData, error: createAuthError } =
        await adminClient.auth.admin.createUser({
          email,
          password: password,
          email_confirm: true,
        });

      if (createAuthError) {
        const errMsg = (createAuthError.message || '').toLowerCase();
        if (errMsg.includes('already') || errMsg.includes('registered') || errMsg.includes('exists')) {
          return new Response(
            JSON.stringify({ success: false, error: 'این شماره قبلاً ثبت شده است.' }),
            { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        return new Response(
          JSON.stringify({ success: false, error: `خطا در ایجاد کاربر احراز هویت: ${createAuthError.message}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const newUserId = createdUserData.user.id;

      // Validate visitor ID if provided
      let validVisitorId: string | null = null;
      if (assigned_visitor_id && assigned_visitor_id !== 'direct') {
        const { data: vCheck } = await adminClient
          .from('visitors')
          .select('id')
          .eq('id', assigned_visitor_id)
          .maybeSingle();
        if (vCheck) {
          validVisitorId = vCheck.id;
        }
      }

      // Insert into profiles (role: 'supermarket', is_active: true, no password column)
      const { error: profileError } = await adminClient.from('profiles').insert({
        id: newUserId,
        name: cleanName,
        role: 'supermarket',
        phone: cleanPhone,
        username: cleanPhone,
        is_active: true,
      });

      if (profileError) {
        return new Response(
          JSON.stringify({ success: false, error: `خطا در ثبت جدول پروفایل: ${profileError.message}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Insert into supermarkets table
      const { error: smError } = await adminClient.from('supermarkets').insert({
        id: newUserId,
        name: cleanName,
        owner: cleanOwner,
        phone: cleanPhone,
        address: cleanAddress,
        assigned_visitor_id: validVisitorId,
        is_active: true,
        username: cleanPhone,
      });

      if (smError) {
        return new Response(
          JSON.stringify({ success: false, error: `خطا در ثبت جدول فروشگاه‌ها: ${smError.message}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const createdSupermarket = {
        id: newUserId,
        name: cleanName,
        owner: cleanOwner,
        phone: cleanPhone,
        address: cleanAddress,
        assigned_visitor_id: validVisitorId || 'direct',
        is_active: true,
        username: cleanPhone,
        created_at: new Date().toISOString(),
      };

      return new Response(
        JSON.stringify({
          success: true,
          userId: newUserId,
          supermarket: createdSupermarket,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // =========================================================================
    // ACTION 5: create_staff / create (Admin Only: Visitor or Warehouse)
    // =========================================================================
    if (action === 'create_staff' || action === 'create') {
      if (!isAdmin) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'دسترسی غیرمجاز: تنها مدیران سیستم مجاز به ایجاد حساب پرسنل هستند.',
          }),
          {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      const { name, phone, role, region, password } = body;

      if (!name?.trim() || !phone?.trim() || !role || !password) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'تکمیل تمامی فیلدهای الزامی (نام، شماره موبایل، نقش و رمز عبور) ضروری است.',
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

      const cleanPhone = normalizePhone(phone);
      if (!isValidMobile(cleanPhone)) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'شماره موبایل وارد شده نامعتبر است. لطفاً شماره موبایل ۱۱ رقمی معتبر وارد کنید (نمونه: ۰۹۱۲۳۴۵۶۷۸۹).',
          }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      if (password.length < MIN_PASSWORD_LENGTH) {
        return new Response(
          JSON.stringify({
            success: false,
            error: `رمز عبور باید حداقل شامل ${MIN_PASSWORD_LENGTH} کاراکتر باشد.`,
          }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      // Check phone uniqueness across profiles
      const { data: existingProfile } = await adminClient
        .from('profiles')
        .select('id')
        .eq('phone', cleanPhone)
        .maybeSingle();

      if (existingProfile) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'این شماره قبلاً ثبت شده است.',
          }),
          {
            status: 409,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      const cleanName = name.trim();
      const cleanRegion = (region || '').trim();
      const cleanUsername = cleanPhone;
      const email = `${cleanPhone}@babolpakhsh.internal`;

      // Create user in Supabase Auth via adminClient (no role in metadata)
      const { data: createdUserData, error: createAuthError } =
        await adminClient.auth.admin.createUser({
          email,
          password: password,
          email_confirm: true,
        });

      if (createAuthError) {
        const errMsg = (createAuthError.message || '').toLowerCase();
        if (errMsg.includes('already') || errMsg.includes('registered') || errMsg.includes('exists')) {
          return new Response(
            JSON.stringify({ success: false, error: 'این شماره قبلاً ثبت شده است.' }),
            { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ success: false, error: `خطا در ایجاد کاربر احراز هویت: ${createAuthError.message}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const newUserId = createdUserData.user.id;

      // Insert profile record with role and phone (no password column)
      const { error: profileInsertError } = await adminClient.from('profiles').upsert({
        id: newUserId,
        name: cleanName,
        role,
        phone: cleanPhone,
        username: cleanUsername,
        is_active: true,
      });

      if (profileInsertError) {
        return new Response(
          JSON.stringify({ success: false, error: `خطا در ثبت جدول پروفایل: ${profileInsertError.message}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // If role is visitor, also insert into visitors table (no password column)
      if (role === 'visitor') {
        const { error: visitorInsertError } = await adminClient.from('visitors').upsert({
          id: newUserId,
          name: cleanName,
          phone: cleanPhone,
          region: cleanRegion || 'منطقه نامشخص',
          username: cleanUsername,
          is_active: true,
        });

        if (visitorInsertError) {
          return new Response(
            JSON.stringify({ success: false, error: `خطا در ثبت جدول ویزیتورها: ${visitorInsertError.message}` }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

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
    }

    return new Response(
      JSON.stringify({ success: false, error: `عملیات درخواستی (${action}) ناشناخته است.` }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
