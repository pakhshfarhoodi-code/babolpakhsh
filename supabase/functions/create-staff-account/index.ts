// @ts-nocheck
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

// Strict CORS: allow barfroosh.ir and development hosts
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

// Generate 10-char secure temporary password avoiding lookalike characters: 0, O, 1, l, I
function generateSecureTemporaryPassword(length = 10): string {
  const safeChars = '23456789abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ';
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  let result = '';
  for (let i = 0; i < length; i++) {
    result += safeChars[array[i] % safeChars.length];
  }
  return result;
}

const MIN_PASSWORD_LENGTH = 6;

Deno.serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);

  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    let supabaseServiceRoleKey =
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SERVICE_ROLE_KEY');

    // Support new Supabase secret keys format if SUPABASE_SERVICE_ROLE_KEY is absent
    if (!supabaseServiceRoleKey) {
      const secretKeysRaw = Deno.env.get('SUPABASE_SECRET_KEYS');
      if (secretKeysRaw) {
        try {
          const parsed = JSON.parse(secretKeysRaw);
          supabaseServiceRoleKey = parsed.service_role || parsed.default || Object.values(parsed)[0];
        } catch {
          supabaseServiceRoleKey = secretKeysRaw;
        }
      }
    }

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      console.error('[create-staff-account] Server configuration error: service_role key not found.');
      return new Response(
        JSON.stringify({
          success: false,
          error: 'پیکربندی سرور ناقص است. لطفاً با پشتیبانی فنی تماس بگیرید.',
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 1. Authenticate caller using JWT from Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('[create-staff-account] Missing Authorization header');
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
      console.error('[create-staff-account] Caller auth error:', callerAuthError?.message);
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

    // 1) Requirement 1: Lookup caller profile ONLY by callerUser.id (no email fallback). If not found -> 403.
    const { data: callerProfile, error: pIdErr } = await adminClient
      .from('profiles')
      .select('id, role, is_active')
      .eq('id', callerUser.id)
      .maybeSingle();

    if (pIdErr || !callerProfile || callerProfile.is_active === false) {
      console.error(
        '[create-staff-account] Caller profile not found or inactive for user ID:',
        callerUser.id,
        pIdErr?.message
      );
      return new Response(
        JSON.stringify({
          success: false,
          error: 'دسترسی غیرمجاز: پروفایل کاربر فراخواننده معتبر نیست.',
        }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const callerRole = callerProfile.role;
    const isCallerSuperAdmin = callerRole === 'superadmin';
    const isCallerAdmin = callerRole === 'admin';
    const isCallerStaffAdmin = isCallerSuperAdmin || isCallerAdmin;
    const isVisitor = callerRole === 'visitor';

    // 3. Parse JSON request body
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

    // Helper: Role hierarchy check for target actions (reset_password, change_phone, delete_account)
    // Hierarchy: superadmin > admin > warehouse/visitor > supermarket
    // Permission rule: Caller must be superadmin, OR caller must be admin and target role in {warehouse, visitor, supermarket}
    // Admin CANNOT perform any action on admin or superadmin
    async function getAndAuthorizeTargetUser(targetUserId: string): Promise<{
      targetProfile: { id: string; role: string; is_active: boolean } | null;
      errorResponse: Response | null;
    }> {
      if (!targetUserId) {
        return {
          targetProfile: null,
          errorResponse: new Response(
            JSON.stringify({ success: false, error: 'شناسه کاربر الزامی است.' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          ),
        };
      }

      const { data: targetProf, error: tErr } = await adminClient
        .from('profiles')
        .select('id, role, is_active')
        .eq('id', targetUserId)
        .maybeSingle();

      if (tErr || !targetProf) {
        console.error('[create-staff-account] Target profile not found:', targetUserId, tErr?.message);
        return {
          targetProfile: null,
          errorResponse: new Response(
            JSON.stringify({ success: false, error: 'کاربر مورد نظر یافت نشد.' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          ),
        };
      }

      const canManage =
        isCallerSuperAdmin ||
        (isCallerAdmin && ['warehouse', 'visitor', 'supermarket'].includes(targetProf.role));

      if (!canManage) {
        return {
          targetProfile: null,
          errorResponse: new Response(
            JSON.stringify({
              success: false,
              error: 'سطح دسترسی شما برای انجام عملیات روی این حساب کاربری کافی نیست.',
            }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          ),
        };
      }

      return { targetProfile: targetProf, errorResponse: null };
    }

    // =========================================================================
    // ACTION 1: reset_password (superadmin, or admin on warehouse/visitor/supermarket)
    // =========================================================================
    if (action === 'reset_password') {
      const { targetProfile, errorResponse } = await getAndAuthorizeTargetUser(body.userId || '');
      if (errorResponse) return errorResponse;

      const userId = targetProfile!.id;
      let finalPassword = '';
      let isGeneratedTemporary = false;

      // 4) Requirement 4: No default '123456'.
      // If body.password is not provided, generate random 10-char temporary password
      // If provided, must be at least 8 characters
      if (!body.password || !body.password.trim()) {
        finalPassword = generateSecureTemporaryPassword(10);
        isGeneratedTemporary = true;
      } else {
        const providedPass = body.password.trim();
        if (providedPass.length < 8) {
          return new Response(
            JSON.stringify({
              success: false,
              error: 'رمز عبور باید حداقل شامل ۸ کاراکتر باشد.',
            }),
            {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }
        finalPassword = providedPass;
      }

      // Update password in Supabase Auth & activate Force Password Change mechanism
      const { error: updateAuthError } = await adminClient.auth.admin.updateUserById(userId, {
        password: finalPassword,
        user_metadata: { must_change_password: true },
      });

      if (updateAuthError) {
        console.error('[create-staff-account] updateUserById error:', updateAuthError.message);
        return new Response(
          JSON.stringify({
            success: false,
            error: 'خطایی در به‌روزرسانی رمز عبور کاربر رخ داد.',
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
          temporaryPassword: finalPassword,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // =========================================================================
    // ACTION 2: change_phone (superadmin, or admin on warehouse/visitor/supermarket)
    // =========================================================================
    if (action === 'change_phone') {
      const { targetProfile, errorResponse } = await getAndAuthorizeTargetUser(body.userId || '');
      if (errorResponse) return errorResponse;

      const userId = targetProfile!.id;
      const targetPhone = body.newPhone || body.phone;

      if (!targetPhone) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'شماره موبایل جدید الزامی است.',
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
            error: 'شماره موبایل وارد شده نامعتبر است (نمونه: ۰۹۱۲۳۴۵۶۷۸۹).',
          }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      // Check phone uniqueness in profiles
      const { data: dupProfile, error: dupCheckErr } = await adminClient
        .from('profiles')
        .select('id')
        .eq('phone', cleanNewPhone)
        .neq('id', userId)
        .maybeSingle();

      if (dupCheckErr) {
        console.error('[create-staff-account] Duplicate check error:', dupCheckErr.message);
        return new Response(
          JSON.stringify({
            success: false,
            error: 'خطایی در بررسی یکتایی شماره تماس رخ داد.',
          }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      if (dupProfile) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'این شماره قبلاً برای حساب دیگری ثبت شده است.',
          }),
          {
            status: 409,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      const newEmail = `${cleanNewPhone}@babolpakhsh.internal`;

      // 1. Update email in Supabase Auth
      const { error: updateAuthErr } = await adminClient.auth.admin.updateUserById(userId, {
        email: newEmail,
      });

      if (updateAuthErr) {
        console.error('[create-staff-account] Auth email update error:', updateAuthErr.message);
        return new Response(
          JSON.stringify({
            success: false,
            error: 'خطایی در تغییر اطلاعات ورود کاربر در سرور رخ داد.',
          }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      // 2. Update in profiles table
      const { error: profUpdErr } = await adminClient
        .from('profiles')
        .update({ phone: cleanNewPhone, username: cleanNewPhone })
        .eq('id', userId);

      if (profUpdErr) {
        console.error('[create-staff-account] profiles table update error:', profUpdErr.message);
      }

      // 3. Update in supermarkets table if exists
      const { error: smUpdErr } = await adminClient
        .from('supermarkets')
        .update({ phone: cleanNewPhone, username: cleanNewPhone })
        .eq('id', userId);

      if (smUpdErr) {
        console.error('[create-staff-account] supermarkets table update error:', smUpdErr.message);
      }

      // 4. Update in visitors table if exists
      const { error: visUpdErr } = await adminClient
        .from('visitors')
        .update({ phone: cleanNewPhone, username: cleanNewPhone })
        .eq('id', userId);

      if (visUpdErr) {
        console.error('[create-staff-account] visitors table update error:', visUpdErr.message);
      }

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
    // ACTION 3: delete_account (superadmin, or admin on warehouse/visitor/supermarket)
    // =========================================================================
    if (action === 'delete_account') {
      const targetUserId = body.userId || '';

      // 3) Requirement 3: Deleting self is forbidden
      if (targetUserId === callerUser.id) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'امکان حذف حساب کاربری خودتان وجود ندارد.',
          }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      const { targetProfile, errorResponse } = await getAndAuthorizeTargetUser(targetUserId);
      if (errorResponse) return errorResponse;

      const userId = targetProfile!.id;
      const targetRole = targetProfile!.role;

      // 3) Requirement 3: Deleting last active admin/superadmin is forbidden
      if (targetRole === 'admin' || targetRole === 'superadmin') {
        const { count, error: countErr } = await adminClient
          .from('profiles')
          .select('id', { count: 'exact', head: true })
          .in('role', ['admin', 'superadmin'])
          .neq('is_active', false);

        if (countErr) {
          console.error('[create-staff-account] Error counting active admins:', countErr.message);
          return new Response(
            JSON.stringify({
              success: false,
              error: 'خطایی در بررسی وضعیت مدیران سامانه رخ داد.',
            }),
            {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }

        if ((count ?? 0) <= 1) {
          return new Response(
            JSON.stringify({
              success: false,
              error: 'امکان حذف آخرین مدیر فعال سامانه وجود ندارد.',
            }),
            {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }
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
        console.error('[create-staff-account] Profile delete warning:', delProfileErr.message);
      }

      // 6. Delete from Supabase Auth
      const { error: delAuthErr } = await adminClient.auth.admin.deleteUser(userId);
      if (delAuthErr) {
        console.error('[create-staff-account] Auth user delete warning:', delAuthErr.message);
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
    // ACTION 4: create_store (Admin, Superadmin, or Visitor)
    // =========================================================================
    if (action === 'create_store') {
      if (!isCallerStaffAdmin && !isVisitor) {
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

      // 5) Requirement 5: When caller is visitor, assigned_visitor_id is ALWAYS caller's own ID
      if (isVisitor) {
        assigned_visitor_id = callerUser.id;
      }

      // Check phone uniqueness across profiles
      const { data: existingProfile, error: existErr } = await adminClient
        .from('profiles')
        .select('id')
        .eq('phone', cleanPhone)
        .maybeSingle();

      if (existErr) {
        console.error('[create-staff-account] Phone check error:', existErr.message);
        return new Response(
          JSON.stringify({
            success: false,
            error: 'خطایی در بررسی یکتایی شماره تماس رخ داد.',
          }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

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

      // Create user in Supabase Auth
      const { data: createdUserData, error: createAuthError } =
        await adminClient.auth.admin.createUser({
          email,
          password: password,
          email_confirm: true,
        });

      if (createAuthError) {
        console.error('[create-staff-account] Auth createUser error:', createAuthError.message);
        const errMsg = (createAuthError.message || '').toLowerCase();
        if (errMsg.includes('already') || errMsg.includes('registered') || errMsg.includes('exists')) {
          return new Response(
            JSON.stringify({ success: false, error: 'این شماره قبلاً ثبت شده است.' }),
            { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        return new Response(
          JSON.stringify({ success: false, error: 'خطا در ایجاد کاربر در سرویس احراز هویت.' }),
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

      // Insert into profiles (role: 'supermarket', is_active: true)
      const { error: profileError } = await adminClient.from('profiles').insert({
        id: newUserId,
        name: cleanName,
        role: 'supermarket',
        phone: cleanPhone,
        username: cleanPhone,
        is_active: true,
      });

      if (profileError) {
        console.error('[create-staff-account] profiles insert error:', profileError.message);
        return new Response(
          JSON.stringify({ success: false, error: 'خطایی در ثبت مشخصات پروفایل فروشگاه رخ داد.' }),
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
        console.error('[create-staff-account] supermarkets insert error:', smError.message);
        return new Response(
          JSON.stringify({ success: false, error: 'خطایی در ثبت اطلاعات فروشگاه رخ داد.' }),
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
    // ACTION 5: create_staff / create (Admin/Superadmin only, role in {warehouse, visitor})
    // =========================================================================
    if (action === 'create_staff' || action === 'create') {
      // 5) Requirement 5: create_staff only by admin/superadmin
      if (!isCallerStaffAdmin) {
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

      // 5) Requirement 5: role must be in {warehouse, visitor}
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
            error: 'شماره موبایل وارد شده نامعتبر است (نمونه: ۰۹۱۲۳۴۵۶۷۸۹).',
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
      const { data: existingProfile, error: existErr } = await adminClient
        .from('profiles')
        .select('id')
        .eq('phone', cleanPhone)
        .maybeSingle();

      if (existErr) {
        console.error('[create-staff-account] Phone check error:', existErr.message);
        return new Response(
          JSON.stringify({
            success: false,
            error: 'خطایی در بررسی یکتایی شماره تماس رخ داد.',
          }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

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

      // Create user in Supabase Auth
      const { data: createdUserData, error: createAuthError } =
        await adminClient.auth.admin.createUser({
          email,
          password: password,
          email_confirm: true,
        });

      if (createAuthError) {
        console.error('[create-staff-account] Staff createUser error:', createAuthError.message);
        const errMsg = (createAuthError.message || '').toLowerCase();
        if (errMsg.includes('already') || errMsg.includes('registered') || errMsg.includes('exists')) {
          return new Response(
            JSON.stringify({ success: false, error: 'این شماره قبلاً ثبت شده است.' }),
            { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ success: false, error: 'خطا در ایجاد حساب کاربری در احراز هویت سرور.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const newUserId = createdUserData.user.id;

      // Insert profile record with role and phone
      const { error: profileInsertError } = await adminClient.from('profiles').upsert({
        id: newUserId,
        name: cleanName,
        role,
        phone: cleanPhone,
        username: cleanUsername,
        is_active: true,
      });

      if (profileInsertError) {
        console.error('[create-staff-account] profile upsert error:', profileInsertError.message);
        return new Response(
          JSON.stringify({ success: false, error: 'خطایی در ثبت پروفایل پرسنل رخ داد.' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // If role is visitor, also insert into visitors table
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
          console.error('[create-staff-account] visitor upsert error:', visitorInsertError.message);
          return new Response(
            JSON.stringify({ success: false, error: 'خطایی در ثبت اطلاعات ویزیتور رخ داد.' }),
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
    // 6) Requirement 6: Generic Persian error to client, details in console.error
    console.error('[create-staff-account] Unhandled server error:', err);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'خطای پیش‌بینی‌نشده‌ای در سرور رخ داد. لطفاً مجدداً تلاش نمایید.',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
