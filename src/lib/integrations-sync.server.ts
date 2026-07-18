// Server-only sync helper used by both the admin server function and the
// public cron hook. Extracted so realtime auto-sync doesn't require an
// authenticated super-admin session.

type TxType =
  | "payment" | "transfer" | "swap" | "nft_mint" | "nft_sale"
  | "merchant_payment" | "withdrawal" | "deposit" | "refund";

const PRO_TYPE_MAP: Record<string, TxType> = {
  send: "transfer", receive: "transfer", buy: "deposit",
  sell: "withdrawal", swap: "swap", mint: "nft_mint",
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
      sequence: item.sequence, tx_id: item.tx_id, tx_hash: item.tx_hash,
      usd_value: item.usd_value, memo: item.memo, original_type: typeRaw,
    },
    p_ts: item.occurred_at ?? new Date().toISOString(),
  };
}

const OPENPAY_CATEGORY_MAP: Record<string, TxType> = {
  topup: "deposit", withdraw: "withdrawal", swap: "swap", nft: "nft_sale",
  staking: "transfer", loan: "transfer", affiliate: "payment",
  mining: "deposit", other: "payment",
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
    p_from: from, p_to: to,
    p_amount: Number(item.amount ?? 0),
    p_currency: String(item.currency_code ?? item.currency ?? "OPEN"),
    p_fee: 0,
    p_status: status,
    p_merchant_id: null,
    p_external_ref: String(item.id ?? ""),
    p_metadata: {
      source_table: item.source_table, event_type: item.event_type,
      category, note: item.note, sender, receiver,
    },
    p_ts: item.occurred_at ?? item.created_at ?? new Date().toISOString(),
  };
}

async function fetchOpenPayPro(baseUrl: string, apiKey: string, since: string) {
  const base = baseUrl.replace(/\/$/, "");
  const items: any[] = [];
  const headers: Record<string, string> = { accept: "application/json" };
  if (apiKey) headers["x-api-key"] = apiKey;
  let cursor: string | null = null;
  for (let i = 0; i < 20; i++) {
    const u = new URL(`${base}/api/public/ledger/entries`);
    u.searchParams.set("limit", "500");
    if (cursor) u.searchParams.set("cursor", cursor);
    else if (since) u.searchParams.set("since", since);
    const res = await fetch(u.toString(), { headers });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
    const body: any = await res.json();
    const data: any[] = Array.isArray(body?.data) ? body.data : [];
    items.push(...data);
    cursor = body?.next_cursor ? String(body.next_cursor) : null;
    if (!cursor || data.length === 0) break;
  }
  return items;
}

async function fetchOpenPay(baseUrl: string, apiKey: string, since: string) {
  const base = baseUrl.replace(/\/$/, "");
  const items: any[] = [];
  const headers: Record<string, string> = { accept: "application/json" };
  if (apiKey) headers["authorization"] = `Bearer ${apiKey}`;
  let cursor: string | null = null;
  for (let i = 0; i < 20; i++) {
    const u = new URL(`${base}/public`);
    u.searchParams.set("limit", "100");
    if (cursor) u.searchParams.set("cursor", cursor);
    else if (since) u.searchParams.set("since", since);
    const res = await fetch(u.toString(), { headers });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
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

export async function runSync(slug: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: integ, error: ierr } = await supabaseAdmin
    .from("integrations").select("*").eq("slug", slug).maybeSingle();
  if (ierr) throw new Error(ierr.message);
  if (!integ) throw new Error("Integration not found");
  if (!integ.base_url) throw new Error("base_url is required before syncing");
  if (slug !== "openpay" && !integ.api_key) throw new Error("api_key is required before syncing");
  if (!integ.enabled) throw new Error("Integration is disabled");

  const since = integ.last_sync_at ?? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  let items: any[] = [];
  try {
    items = slug === "openpay_pro"
      ? await fetchOpenPayPro(integ.base_url, integ.api_key ?? "", since)
      : await fetchOpenPay(integ.base_url, integ.api_key ?? "", since);
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
    const args = slug === "openpay_pro" ? mapProEntry(item) : mapOpenPay(item);
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

  return { slug, ok, failed, total: items.length, errors };
}

export async function runSyncAll() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: rows } = await supabaseAdmin
    .from("integrations").select("slug").eq("enabled", true);
  const results: any[] = [];
  for (const r of rows ?? []) {
    try { results.push(await runSync(r.slug)); }
    catch (e: any) { results.push({ slug: r.slug, error: String(e?.message ?? e) }); }
  }
  return results;
}
