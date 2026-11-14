// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const WELCOME =
  'سلام 👋\n' +
  'به بارفروش، شبکه پخش عمده فرهودی خوش آمدید.\n\n' +
  'برای دیدن کاتالوگ و ثبت سفارش، دکمه «ورود و سفارش» را بزنید.\n' +
  'اولین بار با شماره موبایل و رمز فروشگاه خود وارد شوید؛ دفعات بعد به‌صورت خودکار وارد می‌شوید.';

const SITE_URL = 'https://Barfroosh.ir';

const REPLY_KEYBOARD = {
  keyboard: [
    [{ text: '🛒 ورود و سفارش' }],
    [{ text: '⭐ امتیاز من' }, { text: '🧾 آخرین سفارش' }],
  ],
  resize_keyboard: true,
  is_persistent: true,
};

const STATUS_LABELS: Record<string, string> = {
  assigned: 'آماده ارسال',
  loading: 'در حال بارگیری',
  delegated: 'در حال واگذاری',
  delivered: 'تحویل شده',
  undelivered: 'عدم تحویل',
};

const text = (body: string, status = 200) => new Response(body, { status });

const safeJsonParse = (raw: string) => {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
};

async function tg(token: string, method: string, payload: unknown) {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const body = await res.text();
    if (!res.ok) {
      console.error(`[telegram-webhook] tg ${method} failed:`, res.status, body);
    }
    return body;
  } catch (err) {
    console.error(`[telegram-webhook] tg ${method} error:`, err);
    return JSON.stringify({ ok: false, error: String(err) });
  }
}

async function sendWelcome(token: string, chatId: number | string) {
  await tg(token, 'sendMessage', {
    chat_id: chatId,
    text: WELCOME,
    reply_markup: {
      inline_keyboard: [[{ text: 'ورود و سفارش', web_app: { url: SITE_URL } }]],
    },
  });
  await tg(token, 'sendMessage', {
    chat_id: chatId,
    text: 'از منوی زیر می‌توانید به بخش‌های پرکاربرد دسترسی داشته باشید 👇',
    reply_markup: REPLY_KEYBOARD,
  });
}

function getAdminClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) return null;
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function findLinkedProfileId(adminClient: any, tgUserId: string): Promise<string | null> {
  const { data, error } = await adminClient
    .from('telegram_links')
    .select('profile_id')
    .eq('telegram_user_id', tgUserId)
    .maybeSingle();

  if (error) {
    console.error('[telegram-webhook] telegram_links query error:', error);
    return null;
  }
  return data?.profile_id ? String(data.profile_id) : null;
}

Deno.serve(async (req: Request) => {
  try {
    const token = Deno.env.get('TELEGRAM_BOT_TOKEN');
    const secret = Deno.env.get('TELEGRAM_WEBHOOK_SECRET');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    if (!token || !secret || !supabaseUrl) return text('server_config', 500);

    const url = new URL(req.url);

    // ثبت وب‌هوک، دکمه منو و دستورها (یک بار): GET ...?setup=1&key=SECRET
    if (req.method === 'GET') {
      if (url.searchParams.get('setup') !== '1' || url.searchParams.get('key') !== secret) {
        return text('forbidden', 403);
      }

      const [webhookRaw, menuRaw, commandsRaw] = await Promise.all([
        tg(token, 'setWebhook', {
          url: `${supabaseUrl}/functions/v1/telegram-webhook`,
          secret_token: secret,
          allowed_updates: ['message'],
        }),
        tg(token, 'setChatMenuButton', {
          menu_button: {
            type: 'web_app',
            text: 'ورود و سفارش',
            web_app: { url: SITE_URL },
          },
        }),
        tg(token, 'setMyCommands', {
          commands: [
            { command: 'start', description: 'شروع' },
            { command: 'points', description: 'امتیاز من' },
            { command: 'order', description: 'آخرین سفارش' },
          ],
        }),
      ]);

      return new Response(
        JSON.stringify({
          setWebhook: safeJsonParse(webhookRaw),
          setChatMenuButton: safeJsonParse(menuRaw),
          setMyCommands: safeJsonParse(commandsRaw),
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // دریافت پیام‌ها از تلگرام
    if (req.headers.get('x-telegram-bot-api-secret-token') !== secret) {
      return text('unauthorized', 401);
    }

    let update: any = {};
    try { update = await req.json(); } catch {}
    const msg = update?.message;
    if (msg?.chat?.id && msg.chat.type === 'private') {
      try {
        const chatId = msg.chat.id;
        const rawText = typeof msg.text === 'string' ? msg.text.trim() : '';
        const cmd = rawText.split(/\s+/)[0].split('@')[0].toLowerCase();
        const senderId = String(msg.from?.id ?? msg.chat.id).trim();

        if (rawText === '🛒 ورود و سفارش' || rawText === 'ورود و سفارش') {
          await tg(token, 'sendMessage', {
            chat_id: chatId,
            text: 'برای ورود دکمه زیر را بزنید',
            reply_markup: {
              inline_keyboard: [[{ text: '🛒 ورود و سفارش', web_app: { url: SITE_URL } }]],
            },
          });
        } else if (rawText === '⭐ امتیاز من' || rawText === 'امتیاز من' || cmd === '/points') {
          const adminClient = getAdminClient();
          if (!adminClient) {
            console.error('[telegram-webhook] missing SUPABASE_SERVICE_ROLE_KEY');
            await tg(token, 'sendMessage', {
              chat_id: chatId,
              text: 'در حال حاضر امکان دریافت امتیاز وجود ندارد. لطفاً کمی بعد تلاش کنید.',
            });
            return text('ok');
          }

          const profileId = await findLinkedProfileId(adminClient, senderId);
          if (!profileId) {
            await tg(token, 'sendMessage', {
              chat_id: chatId,
              text: 'ابتدا از دکمه ورود و سفارش وارد حساب خود شوید',
              reply_markup: {
                inline_keyboard: [[{ text: '🛒 ورود و سفارش', web_app: { url: SITE_URL } }]],
              },
            });
            return text('ok');
          }

          const { data: ledgerRows, error: ledgerErr } = await adminClient
            .from('loyalty_ledger')
            .select('points')
            .eq('supermarket_id', profileId)
            .limit(10000);

          if (ledgerErr) {
            console.error('[telegram-webhook] loyalty_ledger query error:', ledgerErr);
            await tg(token, 'sendMessage', {
              chat_id: chatId,
              text: 'خطا در دریافت امتیاز. لطفاً کمی بعد دوباره تلاش کنید.',
            });
            return text('ok');
          }

          const totalPoints = (ledgerRows ?? []).reduce(
            (sum: number, row: any) => sum + (Number(row?.points) || 0),
            0
          );

          await tg(token, 'sendMessage', {
            chat_id: chatId,
            text: `⭐ امتیاز فعلی شما: ${totalPoints.toLocaleString('en-US')}`,
          });
        } else if (rawText === '🧾 آخرین سفارش' || rawText === 'آخرین سفارش' || cmd === '/order') {
          const adminClient = getAdminClient();
          if (!adminClient) {
            console.error('[telegram-webhook] missing SUPABASE_SERVICE_ROLE_KEY');
            await tg(token, 'sendMessage', {
              chat_id: chatId,
              text: 'در حال حاضر امکان دریافت سفارش وجود ندارد. لطفاً کمی بعد تلاش کنید.',
            });
            return text('ok');
          }

          const profileId = await findLinkedProfileId(adminClient, senderId);
          if (!profileId) {
            await tg(token, 'sendMessage', {
              chat_id: chatId,
              text: 'ابتدا از دکمه ورود و سفارش وارد حساب خود شوید',
              reply_markup: {
                inline_keyboard: [[{ text: '🛒 ورود و سفارش', web_app: { url: SITE_URL } }]],
              },
            });
            return text('ok');
          }

          const { data: lastOrder, error: orderErr } = await adminClient
            .from('orders')
            .select('id, status, total_amount, order_date')
            .eq('supermarket_id', profileId)
            .order('order_date', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (orderErr) {
            console.error('[telegram-webhook] orders query error:', orderErr);
            await tg(token, 'sendMessage', {
              chat_id: chatId,
              text: 'خطا در دریافت آخرین سفارش. لطفاً کمی بعد دوباره تلاش کنید.',
            });
            return text('ok');
          }

          if (!lastOrder) {
            await tg(token, 'sendMessage', {
              chat_id: chatId,
              text: 'هنوز سفارشی برای فروشگاه شما ثبت نشده است.',
            });
            return text('ok');
          }

          const statusLabel = STATUS_LABELS[lastOrder.status] ?? lastOrder.status ?? 'نامشخص';
          const amountStr = `${Math.round(Number(lastOrder.total_amount ?? 0)).toLocaleString('en-US')} تومان`;
          const invoiceUrl = `${SITE_URL}/?invoice=${encodeURIComponent(String(lastOrder.id))}`;

          await tg(token, 'sendMessage', {
            chat_id: chatId,
            text:
              `🧾 آخرین سفارش شما\n\n` +
              `شماره: ${lastOrder.id}\n` +
              `وضعیت: ${statusLabel}\n` +
              `مبلغ: ${amountStr}`,
            reply_markup: {
              inline_keyboard: [[{ text: '🧾 مشاهده فاکتور', web_app: { url: invoiceUrl } }]],
            },
          });
        } else {
          await sendWelcome(token, chatId);
        }
      } catch (msgErr) {
        console.error('[telegram-webhook] message handler error:', msgErr);
      }
    }
    // همیشه ۲۰۰ برگردان تا تلگرام دوباره ارسال نکند
    return text('ok');
  } catch (err) {
    console.error('[telegram-webhook] unexpected:', err);
    return text('ok');
  }
});