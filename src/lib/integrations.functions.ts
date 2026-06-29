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

function mapIncoming(item: any, source: SourcePlatform) {
  const typeRaw = String(item.type ?? item.kind ?? "payment").toLowerCase();
  const allowedTypes: TxType[] = [
    "payment","transfer","swap","nft_mint","nft_sale",
    "merchant_payment","withdrawal","deposit","refund",
  ];
  const type = (allowedTypes.includes(typeRaw as TxType) ? typeRaw : "payment") as TxType;
  const statusRaw = String(item.status ?? "confirmed").toLowerCase();
  const status = (["pending","confirmed","failed","reversed"].includes(statusRaw) ? statusRaw : "confirmed") as
    "pending" | "confirmed" | "failed" | "reversed";
  return {
    p_source: source,
    p_type: type,
    p_from: item.from ?? item.from_address ?? item.sender ?? null,
    p_to: item.to ?? item.to_address ?? item.recipient ?? null,
    p_amount: Number(item.amount ?? item.value ?? 0),
    p_currency: String(item.currency ?? item.token ?? item.symbol ?? "OPEN"),
    p_fee: Number(item.fee ?? item.network_fee ?? 0),
    p_status: status,
    p_merchant_id: item.merchant_id ?? item.merchant ?? null,
    p_external_ref: String(item.id ?? item.ref ?? item.tx_id ?? item.hash ?? ""),
    p_metadata: item.metadata ?? {},
    p_ts: item.timestamp ?? item.created_at ?? item.ts ?? new Date().toISOString(),
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
    if (!integ.base_url || !integ.api_key) throw new Error("base_url and api_key are required before syncing");
    if (!integ.enabled) throw new Error("Integration is disabled");

    const since = integ.last_sync_at ?? new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const url = `${integ.base_url.replace(/\/$/, "")}/api/transactions?since=${encodeURIComponent(since)}&limit=200`;

    let res: Response;
    try {
      res = await fetch(url, {
        headers: {
          "authorization": `Bearer ${integ.api_key}`,
          "accept": "application/json",
        },
      });
    } catch (e: any) {
      await supabaseAdmin.from("integrations").update({
        last_sync_at: new Date().toISOString(),
        last_sync_status: "error",
        last_sync_error: `fetch failed: ${e?.message ?? e}`,
        last_sync_count: 0,
      }).eq("id", integ.id);
      throw new Error(`Could not reach ${integ.display_name}: ${e?.message ?? e}`);
    }

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      await supabaseAdmin.from("integrations").update({
        last_sync_at: new Date().toISOString(),
        last_sync_status: "error",
        last_sync_error: `HTTP ${res.status}: ${text.slice(0, 200)}`,
        last_sync_count: 0,
      }).eq("id", integ.id);
      throw new Error(`${integ.display_name} returned HTTP ${res.status}`);
    }

    let payload: any;
    try { payload = await res.json(); } catch {
      throw new Error(`${integ.display_name} returned non-JSON response`);
    }
    const items: any[] = Array.isArray(payload)
      ? payload
      : Array.isArray(payload.transactions)
      ? payload.transactions
      : Array.isArray(payload.data) ? payload.data : [];

    let ok = 0, failed = 0;
    const errors: string[] = [];
    for (const item of items) {
      const args = mapIncoming(item, data.slug as SourcePlatform);
      const { error: rerr } = await supabaseAdmin.rpc("record_transaction" as any, args as any);
      if (rerr) { failed++; if (errors.length < 5) errors.push(rerr.message); }
      else ok++;
    }

    await supabaseAdmin.from("integrations").update({
      last_sync_at: new Date().toISOString(),
      last_sync_status: failed === 0 ? "ok" : "partial",
      last_sync_error: errors[0] ?? null,
      last_sync_count: ok,
    }).eq("id", integ.id);

    return { ok, failed, total: items.length, errors };
  });
