import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertSuperAdmin(ctx: any) {
  const { data, error } = await ctx.supabase.rpc("has_role", {
    _user_id: ctx.userId,
    _role: "super_admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: super_admin only");
}

export const getIngestionConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context);
    const req = getRequest();
    const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "";
    const proto = req.headers.get("x-forwarded-proto") || "https";
    const origin = host ? `${proto}://${host}` : "";
    return {
      origin,
      endpoints: {
        record: `${origin}/api/public/ledger/record`,
        bulk: `${origin}/api/public/ledger/bulk`,
        transactions: `${origin}/api/public/transactions`,
        transaction: `${origin}/api/public/transaction/{hash}`,
        wallet: `${origin}/api/public/wallet/{address}`,
        merchant: `${origin}/api/public/merchant/{id}`,
        token: `${origin}/api/public/token/{symbol}`,
        nft: `${origin}/api/public/nft/{slug}`,
        analytics: `${origin}/api/public/analytics`,
      },
      webhook_secret: process.env.OPENPAY_WEBHOOK_SECRET ?? "",
      signature_header: "x-openpay-signature",
      signature_format: "sha256=<hex hmac of raw body>",
    };
  });

type TxType =
  | "payment" | "transfer" | "swap" | "nft_mint" | "nft_sale"
  | "merchant_payment" | "withdrawal" | "deposit" | "refund";
type SourcePlatform = "openpay" | "openpay_pro";

// OpenPay Pro ledger types → our internal enum
const PRO_TYPE_MAP: Record<string, TxType> = {
  send: "transfer",
  receive: "transfer",
  buy: "deposit",
  sell: "withdrawal",
  swap: "swap",
  mint: "nft_mint",
};

function mapProEntry(item: any): Record<string, any> {
  const typeRaw = String(item.type ?? "send").toLowerCase();
  const type = PRO_TYPE_MAP[typeRaw] ?? "transfer";
  const statusRaw = String(item.status ?? "confirmed").toLowerCase();
  const status = (["pending", "confirmed", "failed", "reversed"].includes(statusRaw)
    ? statusRaw : "confirmed") as "pending" | "confirmed" | "failed" | "reversed";
  return {
    p_source: "openpay_pro",
    p_type: type,
    p_from: item.from_address ?? null,
    p_to: item.to_address ?? null,
    p_amount: Number(item.amount ?? 0),
    p_currency: String(item.asset ?? "OPEN"),
    p_fee: 0,
    p_status: status,
    p_merchant_id: null,
    p_external_ref: String(item.id ?? item.sequence ?? item.tx_id ?? ""),
    p_metadata: {
      sequence: item.sequence,
      tx_id: item.tx_id,
      tx_hash: item.tx_hash,
      usd_value: item.usd_value,
      memo: item.memo,
      original_type: typeRaw,
    },
    p_ts: item.occurred_at ?? new Date().toISOString(),
  };
}

function mapGeneric(item: any, source: SourcePlatform): Record<string, any> {
  const typeRaw = String(item.type ?? item.kind ?? "payment").toLowerCase();
  const allowedTypes: TxType[] = [
    "payment", "transfer", "swap", "nft_mint", "nft_sale",
    "merchant_payment", "withdrawal", "deposit", "refund",
  ];
  const type = (allowedTypes.includes(typeRaw as TxType) ? typeRaw : "payment") as TxType;
  const statusRaw = String(item.status ?? "confirmed").toLowerCase();
  const status = (["pending", "confirmed", "failed", "reversed"].includes(statusRaw)
    ? statusRaw : "confirmed") as "pending" | "confirmed" | "failed" | "reversed";
  return {
    p_source: source,
    p_type: type,
    p_from: item.from ?? item.from_address ?? item.sender ?? null,
    p_to: item.to ?? item.to_address ?? item.recipient ?? null,
    p_amount: Number(item.amount ?? item.value ?? 0),
    p_currency: String(item.currency ?? item.token ?? item.symbol ?? item.asset ?? "OPEN"),
    p_fee: Number(item.fee ?? item.network_fee ?? 0),
    p_status: status,
    p_merchant_id: item.merchant_id ?? item.merchant ?? null,
    p_external_ref: String(item.id ?? item.ref ?? item.tx_id ?? item.hash ?? ""),
    p_metadata: item.metadata ?? {},
    p_ts: item.timestamp ?? item.created_at ?? item.ts ?? new Date().toISOString(),
  };
}

async function fetchOpenPayPro(baseUrl: string, apiKey: string, since: string) {
  const base = baseUrl.replace(/\/$/, "");
  const items: any[] = [];
  const headers = { "x-api-key": apiKey, accept: "application/json" };
  let cursor: string | null = null;
  const maxPages = 20;
  for (let i = 0; i < maxPages; i++) {
    const u = new URL(`${base}/api/public/ledger/entries`);
    u.searchParams.set("limit", "500");
    if (cursor) u.searchParams.set("cursor", cursor);
    else if (since) u.searchParams.set("since", since);
    const res = await fetch(u.toString(), { headers });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
    }
    const body: any = await res.json();
    const data: any[] = Array.isArray(body?.data) ? body.data : [];
    items.push(...data);
    cursor = body?.next_cursor ? String(body.next_cursor) : null;
    if (!cursor || data.length === 0) break;
  }
  return items;
}

async function fetchOpenPay(baseUrl: string, _apiKey: string, since: string) {
  // OpenPay public ledger — no auth required. Cursor pagination via next_cursor.
  const base = baseUrl.replace(/\/$/, "");
  const items: any[] = [];
  const headers = { accept: "application/json" };
  let cursor: string | null = null;
  const maxPages = 20;
  for (let i = 0; i < maxPages; i++) {
    const u = new URL(`${base}/public`);
    u.searchParams.set("limit", "100");
    if (cursor) u.searchParams.set("cursor", cursor);
    else if (since) u.searchParams.set("since", since);
    const res = await fetch(u.toString(), { headers });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
    }
    const body: any = await res.json();
    const data: any[] = Array.isArray(body?.data) ? body.data
      : Array.isArray(body?.events) ? body.events
      : Array.isArray(body) ? body : [];
    items.push(...data);
    cursor = body?.next_cursor ? String(body.next_cursor) : null;
    if (!cursor || data.length === 0) break;
  }
  return items;
}

// OpenPay public-feed category → OpenLedger tx_type
const OPENPAY_CATEGORY_MAP: Record<string, TxType> = {
  topup: "deposit",
  withdraw: "withdrawal",
  swap: "swap",
  nft: "nft_sale",
  staking: "transfer",
  loan: "transfer",
  affiliate: "payment",
  mining: "deposit",
  other: "payment",
};

function mapOpenPay(item: any): Record<string, any> {
  const category = String(item.category ?? "other").toLowerCase();
  const eventType = String(item.event_type ?? "").toLowerCase();
  const type: TxType = OPENPAY_CATEGORY_MAP[category] ??
    (eventType.includes("nft") ? "nft_sale" : "payment");

  const statusRaw = String(item.status ?? "confirmed").toLowerCase();
  const statusMap: Record<string, "pending" | "confirmed" | "failed" | "reversed"> = {
    completed: "confirmed", confirmed: "confirmed",
    pending: "pending", failed: "failed", reversed: "reversed",
  };
  const status = statusMap[statusRaw] ?? "confirmed";

  const sender = item.sender ?? {};
  const receiver = item.receiver ?? {};
  const from = sender.username ?? sender.name ?? item.from_address ?? item.sender_id ?? null;
  const to = receiver.username ?? receiver.name ?? item.to_address ?? item.receiver_id ?? null;

  return {
    p_source: "openpay",
    p_type: type,
    p_from: from,
    p_to: to,
    p_amount: Number(item.amount ?? 0),
    p_currency: String(item.currency_code ?? item.currency ?? "OPEN"),
    p_fee: 0,
    p_status: status,
    p_merchant_id: null,
    p_external_ref: String(item.id ?? ""),
    p_metadata: {
      source_table: item.source_table,
      event_type: item.event_type,
      category,
      note: item.note,
      sender,
      receiver,
    },
    p_ts: item.occurred_at ?? item.created_at ?? new Date().toISOString(),
  };
}

export const syncIntegration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { slug: string }) => {
    if (!data || typeof data.slug !== "string") throw new Error("slug required");
    return data;
  })
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: integ, error: ierr } = await supabaseAdmin
      .from("integrations").select("*").eq("slug", data.slug).maybeSingle();
    if (ierr) throw new Error(ierr.message);
    if (!integ) throw new Error("Integration not found");
    if (!integ.base_url) throw new Error("base_url is required before syncing");
    if (data.slug !== "openpay" && !integ.api_key) throw new Error("api_key is required before syncing");
    if (!integ.enabled) throw new Error("Integration is disabled");

    const since = integ.last_sync_at ?? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    let items: any[] = [];
    try {
      items = data.slug === "openpay_pro"
        ? await fetchOpenPayPro(integ.base_url, integ.api_key, since)
        : await fetchOpenPay(integ.base_url, integ.api_key, since);
    } catch (e: any) {
      await supabaseAdmin.from("integrations").update({
        last_sync_at: new Date().toISOString(),
        last_sync_status: "error",
        last_sync_error: `${e?.message ?? e}`.slice(0, 500),
        last_sync_count: 0,
      }).eq("id", integ.id);
      throw new Error(`${integ.display_name}: ${e?.message ?? e}`);
    }

    let ok = 0, failed = 0;
    const errors: string[] = [];
    for (const item of items) {
      const args = data.slug === "openpay_pro"
        ? mapProEntry(item)
        : mapOpenPay(item);
      const { error: rerr } = await supabaseAdmin.rpc("record_transaction" as any, args as any);
      if (rerr) { failed++; if (errors.length < 5) errors.push(rerr.message); }
      else ok++;
    }

    await supabaseAdmin.from("integrations").update({
      last_sync_at: new Date().toISOString(),
      last_sync_status: failed === 0 ? "ok" : ok === 0 ? "error" : "partial",
      last_sync_error: errors[0] ?? null,
      last_sync_count: ok,
    }).eq("id", integ.id);

    return { ok, failed, total: items.length, errors };
  });

