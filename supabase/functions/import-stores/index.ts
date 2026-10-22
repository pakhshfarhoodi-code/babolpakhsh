// @ts-nocheck
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Normalize Persian and Arabic digits to English
const normalizeDigits = (str: string): string => {
  if (!str) return '';
  const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  let clean = String(str).trim();
  for (let i = 0; i < 10; i++) {
    clean = clean.split(persianDigits[i]).join(String(i));
    clean = clean.split(arabicDigits[i]).join(String(i));
  }
  return clean;
};

// Normalize phone to Iranian 11-digit mobile (09xxxxxxxxx)
const normalizePhone = (str: string): string => {
  if (!str) return '';
  let clean = normalizeDigits(String(str)).replace(/\D/g, '');
  if (clean.startsWith('0098')) {
    clean = '0' + clean.slice(4);
  } else if (clean.startsWith('98') && clean.length >= 12) {
    clean = '0' + clean.slice(2);
  } else if (clean.startsWith('9') && clean.length === 10) {
    clean = '0' + clean;
  }
  return clean;
};

// Generate a random 6-character numeric password
const generateNumericPassword = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    let supabaseServiceRoleKey =
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SERVICE_ROLE_KEY');

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

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'تنظیمات کلیدهای سرور کامل نیست.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Auth verification
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'دسترسی غیرمجاز: هدر توکن یافت نشد.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: { user: callerUser }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !callerUser) {
      return new Response(
        JSON.stringify({ success: false, error: 'نشست کاربری نامعتبر است.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Check admin role
    const { data: callerProfile } = await adminClient
      .from('profiles')
      .select('id, role')
      .eq('id', callerUser.id)
      .maybeSingle();

    if (!callerProfile || (callerProfile.role !== 'admin' && callerProfile.role !== 'superadmin')) {
      return new Response(
        JSON.stringify({ success: false, error: 'تنها مدیران سیستم مجاز به ورود دسته‌ای فروشگاه‌ها هستند.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse payload
    const body = await req.json();
    const rows = Array.isArray(body?.rows) ? body.rows : [];
    const batchTag = body?.batch ? String(body.batch) : 'excel_import';
    const assignedVisitorId = body?.assigned_visitor_id ? String(body.assigned_visitor_id) : null;

    if (rows.length === 0) {
      return new Response(
        JSON.stringify({ success: true, results: [] }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results = [];

    for (const row of rows) {
      const index = row.index ?? 0;
      const name = (row.name || '').trim();
      const owner = (row.owner || '').trim();
      const rawPhone = row.phone || '';
      const landline = (row.landline || '').trim();
      const address = (row.address || '').trim();

      const cleanPhone = normalizePhone(rawPhone);

      if (!name) {
        results.push({
          index,
          name,
          owner,
          phone: cleanPhone || rawPhone,
          status: 'invalid',
          message: 'بدون نام صنف',
        });
        continue;
      }

      if (!cleanPhone || !/^09\d{9}$/.test(cleanPhone)) {
        results.push({
          index,
          name,
          owner,
          phone: cleanPhone || rawPhone,
          status: 'invalid',
          message: 'بدون موبایل معتبر',
        });
        continue;
      }

      try {
        // 1. Check existing in profiles or supermarkets
        const { data: existingProfile } = await adminClient
          .from('profiles')
          .select('id, phone')
          .eq('phone', cleanPhone)
          .maybeSingle();

        if (existingProfile) {
          results.push({
            index,
            name,
            owner,
            phone: cleanPhone,
            status: 'duplicate',
            message: 'شماره قبلاً در سیستم ثبت شده است',
          });
          continue;
        }

        const { data: existingSupermarket } = await adminClient
          .from('supermarkets')
          .select('id, phone')
          .eq('phone', cleanPhone)
          .maybeSingle();

        if (existingSupermarket) {
          results.push({
            index,
            name,
            owner,
            phone: cleanPhone,
            status: 'duplicate',
            message: 'شماره قبلاً در فروشگاه‌ها ثبت شده است',
          });
          continue;
        }

        // 2. Generate random password
        const password = generateNumericPassword();
        const email = `${cleanPhone}@babolpakhsh.internal`;

        // 3. Create Auth User
        const { data: authCreated, error: createAuthErr } = await adminClient.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: {
            role: 'supermarket',
            name,
            phone: cleanPhone,
            must_change_password: true,
          },
        });

        if (createAuthErr || !authCreated?.user) {
          // If auth already exists with this email, treat as duplicate
          if (createAuthErr?.message?.includes('already registered') || createAuthErr?.message?.includes('duplicate')) {
            results.push({
              index,
              name,
              owner,
              phone: cleanPhone,
              status: 'duplicate',
              message: 'حساب کاربری این شماره قبلاً در سیستم ساخته شده است',
            });
            continue;
          }
          throw createAuthErr || new Error('خطا در ایجاد حساب کاربری');
        }

        const newUserId = authCreated.user.id;

        // 4. Create Profile
        const { error: profileErr } = await adminClient.from('profiles').upsert({
          id: newUserId,
          role: 'supermarket',
          name,
          phone: cleanPhone,
          username: cleanPhone,
          is_active: true,
          created_at: new Date().toISOString(),
        });

        if (profileErr) {
          console.error('[import-stores] profile insert error:', profileErr.message);
        }

        // 5. Create Supermarket
        const { error: storeErr } = await adminClient.from('supermarkets').upsert({
          id: newUserId,
          name,
          owner: owner || 'همکار گرامی',
          phone: cleanPhone,
          landline: landline || null,
          address: address || 'ثبت شده از فایل اکسل',
          assigned_visitor_id: assignedVisitorId || null,
          is_active: true,
          approval_status: 'approved',
          registration_source: batchTag,
          import_batch: batchTag,
          created_at: new Date().toISOString(),
        });

        if (storeErr) {
          console.error('[import-stores] supermarket insert error:', storeErr.message);
        }

        results.push({
          index,
          name,
          owner,
          phone: cleanPhone,
          status: 'created',
          password,
        });
      } catch (rowErr) {
        console.error('[import-stores] Row process error:', rowErr);
        results.push({
          index,
          name,
          owner,
          phone: cleanPhone,
          status: 'error',
          message: rowErr instanceof Error ? rowErr.message : 'خطای سرور',
        });
      }
    }

    return new Response(
      JSON.stringify({ success: true, results }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('[import-stores] General error:', err);
    return new Response(
      JSON.stringify({ success: false, error: err instanceof Error ? err.message : 'خطای سرور' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
