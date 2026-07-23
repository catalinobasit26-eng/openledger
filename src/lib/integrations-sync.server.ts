// Server-only sync helper used by both the admin server function and the
// public cron hook. Extracted so realtime auto-sync doesn't require an
// authenticated super-admin session.

import { inferOpenPayTxType, type TxType } from "@/lib/tx-classify";
import { pickRemoteImageUrl, sanitizeMetadataImages } from "@/lib/media";

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

function mapOpenPay(item: any): Record<string, any> {
  const category = String(item.category ?? "other").toLowerCase();
  const type = inferOpenPayTxType(item);
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
      sender_amount: item.sender_amount,
      sender_currency_code: item.sender_currency_code,
      receiver_amount: item.receiver_amount,
      receiver_currency_code: item.receiver_currency_code,
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

// ============ OpenPay NFT (public marketplace API) ============

const NFT_TYPE_MAP: Record<string, TxType> = {
  mint: "nft_mint",
  sale: "nft_sale",
  primary_sale: "nft_sale",
  resale: "nft_sale",
  auction: "nft_sale",
  auction_settlement: "nft_sale",
  bid: "nft_sale",
  gift: "transfer",
  transfer: "transfer",
};

async function fetchOpenPayNft(baseUrl: string, since: string) {
  const base = baseUrl.replace(/\/$/, "");
  const items: any[] = [];
  const headers: Record<string, string> = { accept: "application/json" };
  const sinceMs = since ? new Date(since).getTime() : 0;
  const PAGE = 10; // upstream 546s (WORKER_RESOURCE_LIMIT) on larger limits
  for (let offset = 0; offset < 2000; offset += PAGE) {
    const u = new URL(`${base}/activity`);
    u.searchParams.set("limit", String(PAGE));
    u.searchParams.set("offset", String(offset));
    let body: any = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      const res = await fetch(u.toString(), { headers });
      if (res.ok) { body = await res.json(); break; }
      if (res.status === 546 || res.status === 503 || res.status === 429) {
        await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
        continue;
      }
      throw new Error(`HTTP ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
    }
    if (!body) break; // upstream exhausted; stop gracefully with what we have
    const data: any[] = Array.isArray(body?.activity) ? body.activity
      : Array.isArray(body?.data) ? body.data
      : Array.isArray(body) ? body : [];
    if (data.length === 0) break;
    let stop = false;
    for (const ev of data) {
      const ts = new Date(ev.created_at ?? ev.ts ?? Date.now()).getTime();
      if (sinceMs && ts <= sinceMs) { stop = true; continue; }
      items.push(ev);
    }
    if (stop || data.length < PAGE) break;
  }
  return items;
}

function mapNftActivity(item: any): Record<string, any> {
  const typeRaw = String(item.type ?? "sale").toLowerCase();
  const type: TxType = NFT_TYPE_MAP[typeRaw] ?? "nft_sale";
  return {
    p_source: "openpay_nft",
    p_type: type,
    p_from: item.seller_id ?? item.from ?? item.item?.creator_id ?? null,
    p_to: item.buyer_id ?? item.to ?? null,
    p_amount: Number(item.total ?? item.price_each ?? 0),
    p_currency: String(item.currency ?? "OUSD"),
    p_fee: Number(item.platform_fee ?? 0) + Number(item.royalty_amount ?? 0),
    p_status: "confirmed" as const,
    p_merchant_id: null,
    p_external_ref: String(item.id ?? ""),
    p_metadata: sanitizeMetadataImages({
      original_type: typeRaw,
      quantity: item.quantity,
      price_each: item.price_each,
      royalty_amount: item.royalty_amount,
      platform_fee: item.platform_fee,
      payment_method: item.payment_method,
      item: item.item,
      collection_id: item.item?.collection_id,
    }),
    p_ts: item.created_at ?? new Date().toISOString(),
  };
}

async function syncNftCollections(baseUrl: string, admin: any) {
  const base = baseUrl.replace(/\/$/, "");
  const PAGE = 20;
  try {
    for (let offset = 0; offset < 2000; offset += PAGE) {
      const u = new URL(`${base}/collections`);
      u.searchParams.set("limit", String(PAGE));
      u.searchParams.set("offset", String(offset));
      let body: any = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        const res = await fetch(u.toString(), { headers: { accept: "application/json" } });
        if (res.ok) { body = await res.json(); break; }
        if (res.status === 546 || res.status === 503 || res.status === 429) {
          await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
          continue;
        }
        return;
      }
      if (!body) break;
      const list: any[] = Array.isArray(body?.collections) ? body.collections
        : Array.isArray(body?.data) ? body.data
        : Array.isArray(body) ? body : [];
      if (list.length === 0) break;
      for (const c of list) {
        // Use collection id as slug so activity events (which carry collection_id) match on upsert.
        const slug = String(c.id ?? c.code ?? "").toLowerCase();
        if (!slug) continue;
        await admin.from("nft_collections").upsert({
          slug,
          name: String(c.name ?? c.code ?? slug),
          description: c.description ?? null,
          image_url: pickRemoteImageUrl(c.cover_url, c.image_url, c.banner_url, c.thumbnail_url),
          creator_address: c.creator_id ?? c.creator_address ?? null,
        }, { onConflict: "slug" });
      }
      if (list.length < PAGE) break;
    }
  } catch { /* best-effort */ }
}

async function recordNftEvent(admin: any, ev: any) {
  const collId = ev.item?.collection_id;
  if (!collId) return;
  const slug = String(collId).toLowerCase();
  const itemImg = pickRemoteImageUrl(ev.item?.image_url, ev.item?.cover_url);
  let { data: coll } = await admin.from("nft_collections").select("id,image_url").eq("slug", slug).maybeSingle();
  if (!coll) {
    const { data: created } = await admin.from("nft_collections").upsert({
      slug,
      name: ev.item?.collection_name ?? `Collection ${slug.slice(0, 8)}`,
      image_url: itemImg,
    }, { onConflict: "slug" }).select("id,image_url").maybeSingle();
    coll = created;
  } else if (!coll.image_url && itemImg) {
    await admin.from("nft_collections").update({ image_url: itemImg }).eq("id", coll.id);
  }
  if (!coll) return;
  await admin.from("nft_transactions").upsert({
    collection_id: coll.id,
    token_id: String(ev.item?.code ?? ev.item?.id ?? ev.id),
    event_type: String(ev.type ?? "sale"),
    from_address: ev.seller_id ?? null,
    to_address: ev.buyer_id ?? null,
    price: Number(ev.total ?? ev.price_each ?? 0),
    currency: String(ev.currency ?? "OUSD"),
    tx_hash: String(ev.id ?? ""),
    ts: ev.created_at ?? new Date().toISOString(),
  });
}

export async function runSync(slug: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: integ, error: ierr } = await supabaseAdmin
    .from("integrations").select("*").eq("slug", slug).maybeSingle();
  if (ierr) throw new Error(ierr.message);
  if (!integ) throw new Error("Integration not found");
  if (!integ.base_url) throw new Error("base_url is required before syncing");
  if (slug !== "openpay" && slug !== "openpay_nft" && !integ.api_key) throw new Error("api_key is required before syncing");
  if (!integ.enabled) throw new Error("Integration is disabled");

  const since = integ.last_sync_at ?? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  let items: any[] = [];
  try {
    if (slug === "openpay_pro") items = await fetchOpenPayPro(integ.base_url, integ.api_key ?? "", since);
    else if (slug === "openpay_nft") {
      await syncNftCollections(integ.base_url, supabaseAdmin);
      items = await fetchOpenPayNft(integ.base_url, since);
    } else items = await fetchOpenPay(integ.base_url, integ.api_key ?? "", since);
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
    const args = slug === "openpay_pro" ? mapProEntry(item)
      : slug === "openpay_nft" ? mapNftActivity(item)
      : mapOpenPay(item);
    const { error: rerr } = await supabaseAdmin.rpc("record_transaction" as any, args as any);
    if (rerr) { failed++; if (errors.length < 5) errors.push(rerr.message); }
    else {
      ok++;
      if (slug === "openpay_nft") {
        try { await recordNftEvent(supabaseAdmin, item); } catch { /* best-effort */ }
      }
    }
  }

  if (slug === "openpay_nft") {
    try { await supabaseAdmin.rpc("refresh_nft_collection_stats" as any); } catch { /* best-effort */ }
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
