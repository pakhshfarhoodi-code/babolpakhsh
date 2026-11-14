import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const fmt = (n: number) => Math.round(n).toLocaleString("en-US");

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

// ---------- محاسبه‌ی مالی (مطابق orderLine.ts و InvoiceDocument) ----------
const getPack = (v: unknown) => {
  const n = Number(v);
  return n > 0 ? n : 1;
};

function unitFromCatalog(raw: number, pack: number, p: any): number {
  const pStore = Number(p?.price ?? 0);
  const pVis = Number(p?.visitor_price ?? 0);
  const hasRaw = raw > 1;
  if (pStore > 1) {
    if (hasRaw && Math.abs(raw - pStore * pack) < Math.abs(raw - pStore)) return Math.round(raw / pack);
    return pStore;
  }
  if (hasRaw) return raw;
  if (pVis > 1) return pVis;
  return raw;
}

async function financialBlock(o: any, items: any[]): Promise<string> {
  const ids = items.map((i) => i.product_id).filter(Boolean);
  const prodMap = new Map<string, any>();
  if (ids.length) {
    const { data } = await supabase
      .from("products").select("id, price, visitor_price, items_per_package").in("id", ids);
    (data ?? []).forEach((p: any) => prodMap.set(p.id, p));
  }

  const isConsumer = o.customer_type === "consumer";
  const pickup = Number(o.pickup_discount_percent ?? 0);
  const founder = Number(o.founder_discount_percent ?? 0);
  const manual = o.discount_status === "approved" ? Number(o.discount_percent ?? 0) : 0;
  const totalPct = isConsumer ? 0 : Math.min(100, Math.max(0, pickup + founder + manual));

  let subtotal = 0;
  let discounted = 0;
  for (const it of items) {
    const p = prodMap.get(it.product_id);
    const pack = getPack(it.items_per_package || p?.items_per_package);
    const qty = Number(it.quantity) || 0;
    const raw = Number(it.price) || 0;
    const unit = isConsumer ? raw / pack : unitFromCatalog(raw, pack, p);
    subtotal += Math.round(qty * pack * unit);
    const du = Math.round((unit * (100 - totalPct)) / 100);
    discounted += Math.round(qty * pack * du);
  }
  if (subtotal <= 0) {
    subtotal = Number(o.total_amount ?? 0);
    discounted = Math.round((subtotal * (100 - totalPct)) / 100);
  }

  const lines: string[] = [];

  if (isConsumer) {
    const savings = Number(o.consumer_savings ?? 0);
    if (savings > 0) {
      lines.push(`مبلغ قبل از تخفیف: ${fmt(subtotal + savings)} تومان`);
      lines.push(`تخفیف اعمال‌شده: -${fmt(savings)} تومان`);
    }
    lines.push(`مبلغ قابل پرداخت: ${fmt(subtotal)} تومان`);
    return lines.join("\n");
  }

  let vatAmount = 0;
  let vatPercent = 0;
  const { data: st } = await supabase
    .from("app_settings").select("value").eq("key", "invoice_settings").maybeSingle();
  if (st?.value?.has_vat) {
    vatPercent = Number(st.value.vat_percent) || 0;
    vatAmount = Math.round((discounted * vatPercent) / 100);
  }

  lines.push(`مبلغ فاکتور: ${fmt(subtotal)} تومان`);
  if (totalPct > 0) {
    if (pickup > 0) lines.push(`تخفیف درب انبار (${pickup}٪): -${fmt(Math.round((subtotal * pickup) / 100))}`);
    if (founder > 0) lines.push(`تخفیف ویژه فروشگاه‌های اول (${founder}٪): -${fmt(Math.round((subtotal * founder) / 100))}`);
    if (manual > 0) lines.push(`تخفیف ویژه (${manual}٪): -${fmt(Math.round((subtotal * manual) / 100))}`);
    lines.push(`جمع تخفیف: -${fmt(subtotal - discounted)} تومان`);
    lines.push(`جمع پس از تخفیف: ${fmt(discounted)} تومان`);
  }
  if (vatAmount > 0) lines.push(`مالیات (${vatPercent}٪): +${fmt(vatAmount)}`);
  if (totalPct > 0 || vatAmount > 0) lines.push(`مبلغ قابل پرداخت: ${fmt(discounted + vatAmount)} تومان`);
  return lines.join("\n");
}

// ---------- ارسال ----------
async function sendEitaa(chatId: string, text: string) {
  try {
    const r = await fetch("https://eitaayar.ir/api/app/sendMessage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: Deno.env.get("EITAA_BOT_TOKEN"), chat_id: chatId, text }),
    });
    if (!r.ok) console.error("eitaa send failed", chatId, r.status, await r.text());
  } catch (e) {
    console.error("eitaa send error", chatId, e);
  }
}

Deno.serve(async (req) => {
  const secret = Deno.env.get("EITAA_NOTIFY_SECRET");
  if (!secret || req.headers.get("x-webhook-secret") !== secret) {
    return new Response("unauthorized", { status: 401 });
  }

  let payload: any;
  try { payload = await req.json(); } catch { return new Response("bad json", { status: 400 }); }

  const type = payload.type as string;
  const rec = payload.record;
  const old = payload.old_record;
  if (!rec?.id) return new Response("no record", { status: 200 });

  let title = "";
  let notifyAdmins = false;
  let notifyStore = false;
  let visitorId: string | null = null;

  if (type === "INSERT") {
    if (rec.status !== "assigned") return new Response("skip", { status: 200 });
    title = "🛒 سفارش جدید";
    notifyAdmins = true;
    notifyStore = true;
    if (rec.assigned_visitor_id && rec.assigned_visitor_id !== "direct" && rec.order_channel !== "visitor_field") {
      visitorId = rec.assigned_visitor_id;
    }
    await sleep(2000); // صبر برای ثبت آیتم‌ها
  } else if (type === "UPDATE") {
    if (
      !rec.assigned_visitor_id ||
      rec.assigned_visitor_id === "direct" ||
      rec.assigned_visitor_id === old?.assigned_visitor_id
    ) return new Response("skip", { status: 200 });
    title = "📦 سفارش به شما ارجاع شد";
    visitorId = rec.assigned_visitor_id;
  } else {
    return new Response("skip", { status: 200 });
  }

  const { data: order } = await supabase
    .from("orders")
    .select(
      "id, supermarket_id, supermarket_name, visitor_name, total_amount, customer_type, consumer_savings, pickup_discount_percent, founder_discount_percent, discount_percent, discount_status",
    )
    .eq("id", rec.id)
    .maybeSingle();
  const o = order ?? rec;

  // اطلاعات تماس مشتری
  let sm: any = null;
  if (o.supermarket_id) {
    const { data } = await supabase
      .from("supermarkets")
      .select("owner, phone, address")
      .eq("id", o.supermarket_id)
      .maybeSingle();
    sm = data;
  }

  const { data: items } = await supabase
    .from("order_items")
    .select("product_id, name, price, quantity, items_per_package")
    .eq("order_id", rec.id);
  const allItems = items ?? [];

  const shown = allItems.slice(0, 12).map((i: any) => `• ${i.name} × ${i.quantity}`).join("\n");
  const more = allItems.length > 12 ? `\n… و ${allItems.length - 12} قلم دیگر` : "";
  const itemsText = allItems.length ? `\n\n${shown}${more}` : "";

  const money = await financialBlock(o, allItems);
  const head =
    `${title}\n\n` +
    `شماره: ${o.id}\n` +
    `فروشگاه: ${o.supermarket_name ?? "—"}\n`;
  const customerInfo =
    (o.customer_type === "consumer" ? "نوع مشتری: مصرف‌کننده\n" : "") +
    (sm?.owner && sm.owner !== o.supermarket_name ? `مالک: ${sm.owner}\n` : "") +
    `تلفن: ${sm?.phone || "—"}\n` +
    `آدرس: ${sm?.address || "—"}\n`;
  const rest = `ویزیتور: ${o.visitor_name || "—"}\n` + money + itemsText;
  const staffText = head + customerInfo + rest;
  let storeText = `✅ سفارش شما ثبت شد\n\n${head}${rest}`;

  if (notifyStore && o.customer_type !== "consumer") {
    try {
      const [ptsRes, cfgRes] = await Promise.all([
        supabase.rpc("_loyalty_order_points", { p_order_id: rec.id }),
        supabase.rpc("_loyalty_settings"),
      ]);
      if (!ptsRes.error && !cfgRes.error) {
        const pts = Number(ptsRes.data ?? 0);
        const rawCfg = Array.isArray(cfgRes.data) ? cfgRes.data[0] : cfgRes.data;
        const cfg = typeof rawCfg === "string" ? JSON.parse(rawCfg) : rawCfg;
        if (pts > 0 && cfg?.enabled === true) {
          storeText += `\n\n⭐ ${pts} امتیاز بابت خرید شما به زودی به حساب شما اضافه خواهد شد.`;
        }
      } else {
        console.error("loyalty rpc error", ptsRes.error ?? cfgRes.error);
      }
    } catch (e) {
      console.error("loyalty rpc exception", e);
    }
  }

  storeText += `\n\n🧾 مشاهده فاکتور: https://barfroosh.ir/?invoice=${encodeURIComponent(String(o.id))}`;

  const recipients = new Map<string, string>();

  if (notifyStore && o.supermarket_id) {
    const { data: l } = await supabase
      .from("eitaa_links").select("eitaa_user_id").eq("profile_id", o.supermarket_id).maybeSingle();
    if (l?.eitaa_user_id) recipients.set(String(l.eitaa_user_id), storeText);
  }

  const staffIds: string[] = [];
  if (visitorId) staffIds.push(visitorId);
  if (notifyAdmins) {
    const { data: admins } = await supabase
      .from("profiles").select("id").eq("role", "admin").eq("is_active", true);
    (admins ?? []).forEach((a: any) => staffIds.push(a.id));
  }
  if (staffIds.length) {
    const { data: contacts } = await supabase
      .from("eitaa_contacts").select("eitaa_user_id").in("profile_id", staffIds);
    (contacts ?? []).forEach((c: any) => recipients.set(String(c.eitaa_user_id), staffText));
  }

  for (const [chatId, text] of recipients) {
    await sendEitaa(chatId, text);
    await sleep(250);
  }

  return new Response(JSON.stringify({ ok: true, sent: recipients.size }), {
    headers: { "Content-Type": "application/json" },
  });
});