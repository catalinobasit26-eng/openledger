/** OpenPay Pro — Public Ledger API (+ local OpenLedger mirror fallback) */

import { createClient } from "@supabase/supabase-js";

export const OPENPAY_PRO_LEDGER_BASE_DEFAULT = "https://openpaypromainnet.lovable.app";
export const OPENPAY_PRO_APP_URL = "https://openpaypromainnet.lovable.app";

export type ProLedgerEntry = {
  id: string;
  sequence: number;
  tx_id?: string | null;
  from_address?: string | null;
  to_address?: string | null;
  asset: string;
  amount: string | number;
  usd_value?: string | number | null;
  type: string;
  status: string;
  tx_hash?: string | null;
  memo?: string | null;
  occurred_at: string;
};

export type ProLedgerStats = {
  total_entries: number;
  latest_sequence: number;
  latest_at: string | null;
  server_time?: string;
  feed?: "live" | "mirrored";
};

export type ProLedgerEntriesResponse = {
  count: number;
  next_cursor: string | null;
  data: ProLedgerEntry[];
  feed?: "live" | "mirrored";
};

export type ProLedgerEntryType = "send" | "receive" | "buy" | "sell" | "swap" | "mint" | "reward";

export type ProLedgerCreds = {
  baseUrl: string;
  apiKey: string;
  source: "env" | "integrations";
};

function normalizeBase(url: string): string {
  return url.replace(/\/$/, "").replace(/\/api\/public\/ledger$/i, "");
}

function ledgerRoot(baseUrl: string): string {
  return `${normalizeBase(baseUrl)}/api/public/ledger`;
}

function envProKey(): string {
  return (
    process.env.OPENPAY_PRO_LEDGER_API_KEY ||
    process.env.OPENPAY_LEDGER_KEY ||
    process.env.OPENPAY_PRO_API_KEY ||
    ""
  );
}

function envProBase(): string {
  return process.env.OPENPAY_PRO_LEDGER_BASE || process.env.OPENPAY_PRO_BASE_URL || "";
}

function hasServiceRole(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function pubClient() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY for mirrored Pro ledger.");
  }
  return createClient(url, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

/** Resolve Pro ledger base URL + API key (env first, then integrations if service role exists). */
export async function resolveProLedgerCreds(): Promise<ProLedgerCreds | null> {
  const envKey = envProKey();
  const envBase = envProBase();

  if (envKey) {
    return {
      baseUrl: normalizeBase(envBase || OPENPAY_PRO_LEDGER_BASE_DEFAULT),
      apiKey: envKey,
      source: "env",
    };
  }

  if (!hasServiceRole()) return null;

  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("integrations")
      .select("base_url, api_key")
      .eq("slug", "openpay_pro")
      .maybeSingle();

    if (error || !data?.api_key) return null;

    return {
      baseUrl: normalizeBase(data.base_url || envBase || OPENPAY_PRO_LEDGER_BASE_DEFAULT),
      apiKey: data.api_key,
      source: "integrations",
    };
  } catch {
    return null;
  }
}

async function proGetLive<T>(
  creds: ProLedgerCreds,
  path: string,
  query: Record<string, string | number | undefined> = {},
  signal?: AbortSignal,
): Promise<T> {
  const url = new URL(`${ledgerRoot(creds.baseUrl)}${path.startsWith("/") ? path : `/${path}`}`);
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === "") continue;
    url.searchParams.set(k, String(v));
  }

  const res = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
      "x-api-key": creds.apiKey,
      Authorization: `Bearer ${creds.apiKey}`,
    },
    signal: signal ?? AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`OpenPay Pro ledger ${res.status}: ${body.slice(0, 240) || res.statusText}`);
  }

  return res.json() as Promise<T>;
}

function meta(row: { metadata?: unknown }): Record<string, unknown> {
  const m = row.metadata;
  return m && typeof m === "object" && !Array.isArray(m) ? (m as Record<string, unknown>) : {};
}

function mapLocalRow(row: {
  id: string;
  hash: string;
  block_number: number;
  from_address: string | null;
  to_address: string | null;
  amount: number;
  currency: string;
  type: string;
  status: string;
  ts: string;
  external_ref: string | null;
  metadata?: unknown;
}): ProLedgerEntry {
  const m = meta(row);
  const originalType = typeof m.original_type === "string" ? m.original_type : row.type;
  const sequence =
    typeof m.sequence === "number"
      ? m.sequence
      : Number.isFinite(Number(m.sequence))
        ? Number(m.sequence)
        : row.block_number;
  return {
    id: row.external_ref || row.id,
    sequence,
    tx_id: typeof m.tx_id === "string" ? m.tx_id : row.external_ref,
    from_address: row.from_address,
    to_address: row.to_address,
    asset: row.currency,
    amount: row.amount,
    usd_value: m.usd_value as string | number | null | undefined,
    type: originalType,
    status: row.status,
    tx_hash: (typeof m.tx_hash === "string" ? m.tx_hash : null) || row.hash,
    memo: typeof m.memo === "string" ? m.memo : null,
    occurred_at: row.ts,
  };
}

/** OpenLedger `tx_type` enum values that Pro ledger types map into when mirrored. */
const VALID_TX_TYPES = new Set([
  "payment",
  "transfer",
  "swap",
  "nft_mint",
  "nft_sale",
  "merchant_payment",
  "withdrawal",
  "deposit",
  "refund",
  "stake",
]);

/**
 * Pro API type → local mirror filter.
 * Never put Pro-only labels (send/receive/buy/…) into `.eq("type", …)` — they are not in `tx_type`.
 * Disambiguate subtypes (send vs receive, buy vs reward) via metadata.original_type.
 */
const MIRROR_TYPE_FILTER: Record<
  string,
  { dbTypes: string[]; originalTypes: string[] }
> = {
  send: { dbTypes: ["transfer"], originalTypes: ["send"] },
  receive: { dbTypes: ["transfer"], originalTypes: ["receive"] },
  buy: { dbTypes: ["deposit"], originalTypes: ["buy"] },
  sell: { dbTypes: ["withdrawal"], originalTypes: ["sell"] },
  swap: { dbTypes: ["swap"], originalTypes: ["swap"] },
  mint: { dbTypes: ["nft_mint"], originalTypes: ["mint"] },
  reward: { dbTypes: ["deposit", "payment"], originalTypes: ["reward"] },
};

function rowMatchesProType(
  row: { type: string; metadata?: unknown },
  proType: string,
): boolean {
  const mapped = MIRROR_TYPE_FILTER[proType];
  if (!mapped) return true;
  const m = meta(row);
  const original =
    typeof m.original_type === "string" ? m.original_type.toLowerCase() : "";
  if (original) return mapped.originalTypes.includes(original);
  // Legacy rows without original_type: match on stored enum only when unambiguous.
  const t = (row.type || "").toLowerCase();
  if (proType === "send" || proType === "receive") return false;
  if (proType === "buy" || proType === "reward") return false;
  return mapped.dbTypes.includes(t);
}

async function fetchMirroredStats(): Promise<ProLedgerStats> {
  const sb = pubClient();
  const countQ = await sb
    .from("ledger_transactions")
    .select("id", { count: "exact", head: true })
    .eq("source", "openpay_pro");
  if (countQ.error) throw new Error(countQ.error.message);

  const latestQ = await sb
    .from("ledger_transactions")
    .select("ts, block_number, metadata")
    .eq("source", "openpay_pro")
    .order("ts", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latestQ.error) throw new Error(latestQ.error.message);

  const latest = latestQ.data;
  const m = latest ? meta(latest) : {};
  const latestSequence =
    typeof m.sequence === "number"
      ? m.sequence
      : Number(m.sequence) || latest?.block_number || 0;

  return {
    total_entries: countQ.count ?? 0,
    latest_sequence: latestSequence,
    latest_at: latest?.ts ?? null,
    server_time: new Date().toISOString(),
    feed: "mirrored",
  };
}

async function fetchMirroredEntries(opts: {
  limit?: number;
  cursor?: string;
  asset?: string;
  type?: string;
  address?: string;
  since?: string;
}): Promise<ProLedgerEntriesResponse> {
  const limit = Math.min(500, Math.max(1, opts.limit ?? 100));
  const offset = Math.max(0, Number(opts.cursor || 0) || 0);
  const sb = pubClient();
  const typeFilter = opts.type && MIRROR_TYPE_FILTER[opts.type] ? MIRROR_TYPE_FILTER[opts.type] : null;
  // Oversample when we must post-filter by Pro subtype (send/receive/buy/reward).
  const needsPostFilter = Boolean(
    typeFilter && (opts.type === "send" || opts.type === "receive" || opts.type === "buy" || opts.type === "reward"),
  );
  const fetchCount = needsPostFilter ? Math.min(500, Math.max(limit * 4, limit)) : limit;

  let q = sb
    .from("ledger_transactions")
    .select("id, hash, block_number, from_address, to_address, amount, currency, type, status, ts, external_ref, metadata")
    .eq("source", "openpay_pro")
    .order("ts", { ascending: false })
    .range(offset, offset + fetchCount - 1);

  if (opts.asset) q = q.ilike("currency", opts.asset);
  if (opts.since) q = q.gte("ts", opts.since);
  if (opts.address) {
    q = q.or(`from_address.eq.${opts.address},to_address.eq.${opts.address}`);
  }
  if (typeFilter) {
    const dbTypes = typeFilter.dbTypes.filter((t) => VALID_TX_TYPES.has(t));
    if (dbTypes.length === 1) q = q.eq("type", dbTypes[0]!);
    else if (dbTypes.length > 1) q = q.in("type", dbTypes);

    // Prefer metadata.original_type when PostgREST can filter JSON (send/receive/etc.).
    if (typeFilter.originalTypes.length === 1) {
      q = q.filter("metadata->>original_type", "eq", typeFilter.originalTypes[0]!);
    }
  }

  const { data, error } = await q;
  if (error) {
    // Fallback if JSON path filter isn't supported: enum-only query + client filter.
    if (typeFilter && /original_type|metadata|operator/i.test(error.message)) {
      let q2 = sb
        .from("ledger_transactions")
        .select("id, hash, block_number, from_address, to_address, amount, currency, type, status, ts, external_ref, metadata")
        .eq("source", "openpay_pro")
        .order("ts", { ascending: false })
        .range(offset, offset + fetchCount - 1);
      if (opts.asset) q2 = q2.ilike("currency", opts.asset);
      if (opts.since) q2 = q2.gte("ts", opts.since);
      if (opts.address) {
        q2 = q2.or(`from_address.eq.${opts.address},to_address.eq.${opts.address}`);
      }
      const dbTypes = typeFilter.dbTypes.filter((t) => VALID_TX_TYPES.has(t));
      if (dbTypes.length === 1) q2 = q2.eq("type", dbTypes[0]!);
      else if (dbTypes.length > 1) q2 = q2.in("type", dbTypes);

      const retry = await q2;
      if (retry.error) throw new Error(retry.error.message);
      const filtered = (retry.data ?? [])
        .filter((row) => rowMatchesProType(row, opts.type!))
        .slice(0, limit)
        .map(mapLocalRow);
      return {
        count: filtered.length,
        next_cursor: filtered.length >= limit ? String(offset + limit) : null,
        data: filtered,
        feed: "mirrored",
      };
    }
    throw new Error(error.message);
  }

  let rows = (data ?? []).map(mapLocalRow);
  if (opts.type && typeFilter) {
    rows = rows.filter((row) => {
      const t = (row.type || "").toLowerCase();
      return t === opts.type || typeFilter.originalTypes.includes(t);
    });
  }
  rows = rows.slice(0, limit);
  const next_cursor = rows.length >= limit ? String(offset + limit) : null;

  return {
    count: rows.length,
    next_cursor,
    data: rows,
    feed: "mirrored",
  };
}

async function fetchMirroredEntry(idOrSequence: string): Promise<ProLedgerEntry> {
  const sb = pubClient();
  const asSeq = Number(idOrSequence);

  let q = sb
    .from("ledger_transactions")
    .select("id, hash, block_number, from_address, to_address, amount, currency, type, status, ts, external_ref, metadata")
    .eq("source", "openpay_pro")
    .limit(1);

  if (Number.isFinite(asSeq) && String(asSeq) === idOrSequence) {
    // sequence may live in metadata or block_number
    const byBlock = await q.eq("block_number", asSeq).maybeSingle();
    if (!byBlock.error && byBlock.data) return mapLocalRow(byBlock.data);
  }

  const byRef = await sb
    .from("ledger_transactions")
    .select("id, hash, block_number, from_address, to_address, amount, currency, type, status, ts, external_ref, metadata")
    .eq("source", "openpay_pro")
    .or(`id.eq.${idOrSequence},external_ref.eq.${idOrSequence},hash.eq.${idOrSequence}`)
    .limit(1)
    .maybeSingle();

  if (byRef.error) throw new Error(byRef.error.message);
  if (!byRef.data) throw new Error("Entry not found");
  return mapLocalRow(byRef.data);
}

export async function fetchProLedgerStats(): Promise<ProLedgerStats> {
  const creds = await resolveProLedgerCreds();
  if (creds) {
    try {
      const live = await proGetLive<ProLedgerStats>(creds, "/stats");
      return { ...live, feed: "live" };
    } catch (e) {
      // Fall through to local mirror if live upstream fails.
      console.warn("[pro-ledger] live stats failed, using mirror:", e);
    }
  }
  return fetchMirroredStats();
}

export async function fetchProLedgerEntries(opts: {
  limit?: number;
  cursor?: string;
  asset?: string;
  type?: string;
  address?: string;
  since?: string;
} = {}): Promise<ProLedgerEntriesResponse> {
  const limit = Math.min(500, Math.max(1, opts.limit ?? 100));
  const creds = await resolveProLedgerCreds();
  if (creds) {
    try {
      const body = await proGetLive<ProLedgerEntriesResponse>(creds, "/entries", {
        limit,
        cursor: opts.cursor,
        asset: opts.asset,
        type: opts.type,
        address: opts.address,
        since: opts.since,
      });
      const data = Array.isArray(body.data) ? body.data : [];
      return {
        count: typeof body.count === "number" ? body.count : data.length,
        next_cursor: body.next_cursor != null ? String(body.next_cursor) : null,
        data,
        feed: "live",
      };
    } catch (e) {
      console.warn("[pro-ledger] live entries failed, using mirror:", e);
    }
  }
  return fetchMirroredEntries({ ...opts, limit });
}

export async function fetchProLedgerEntry(idOrSequence: string): Promise<ProLedgerEntry> {
  const creds = await resolveProLedgerCreds();
  if (creds) {
    try {
      const body = await proGetLive<ProLedgerEntry | { data: ProLedgerEntry } | { entry: ProLedgerEntry }>(
        creds,
        `/entries/${encodeURIComponent(idOrSequence)}`,
      );
      if (body && typeof body === "object" && "id" in body && "sequence" in body) {
        return body as ProLedgerEntry;
      }
      if (body && typeof body === "object" && "data" in body && (body as { data: ProLedgerEntry }).data) {
        return (body as { data: ProLedgerEntry }).data;
      }
      if (body && typeof body === "object" && "entry" in body && (body as { entry: ProLedgerEntry }).entry) {
        return (body as { entry: ProLedgerEntry }).entry;
      }
    } catch (e) {
      console.warn("[pro-ledger] live entry failed, using mirror:", e);
    }
  }
  return fetchMirroredEntry(idOrSequence);
}

export function proLedgerPublicBase(baseUrl = OPENPAY_PRO_LEDGER_BASE_DEFAULT): string {
  return ledgerRoot(baseUrl);
}

export function proLedgerConfigHint(): string {
  return "Set OPENPAY_PRO_LEDGER_API_KEY (optional OPENPAY_PRO_LEDGER_BASE) for the live Pro API, or sync openpay_pro in Admin to populate the local mirror.";
}
