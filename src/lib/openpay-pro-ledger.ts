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

export type ProLedgerEntryType = "send" | "receive" | "buy" | "sell" | "swap" | "mint";

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
  return process.env.OPENPAY_PRO_LEDGER_API_KEY || process.env.OPENPAY_PRO_API_KEY || "";
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

const LOCAL_TYPE_FILTER: Record<string, string[]> = {
  send: ["send", "transfer"],
  receive: ["receive", "transfer"],
  buy: ["buy", "deposit"],
  sell: ["sell", "withdrawal"],
  swap: ["swap"],
  mint: ["mint", "nft_mint"],
};

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

  let q = sb
    .from("ledger_transactions")
    .select("id, hash, block_number, from_address, to_address, amount, currency, type, status, ts, external_ref, metadata")
    .eq("source", "openpay_pro")
    .order("ts", { ascending: false })
    .range(offset, offset + limit - 1);

  if (opts.asset) q = q.ilike("currency", opts.asset);
  if (opts.since) q = q.gte("ts", opts.since);
  if (opts.address) {
    q = q.or(`from_address.eq.${opts.address},to_address.eq.${opts.address}`);
  }
  if (opts.type && LOCAL_TYPE_FILTER[opts.type]) {
    // Prefer original Pro type in metadata when present; also match mapped local types.
    const types = LOCAL_TYPE_FILTER[opts.type];
    q = q.or(types.map((t) => `type.eq.${t}`).join(","));
  }

  const { data, error } = await q;
  if (error) throw new Error(error.message);

  const rows = (data ?? []).map(mapLocalRow);
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
