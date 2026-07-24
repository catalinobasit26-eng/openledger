/** OpenPay testnet public ledger API (OpenLedger feed). */

export const OPENLEDGER_TESTNET_API =
  "https://kwphwirkmgvpelzfivrz.supabase.co/functions/v1/public-ledger-api";

export type OpenLedgerParty = {
  name: string;
  username: string;
  avatar_url?: string;
};

export type OpenLedgerEntry = {
  id: string | null;
  event_type: string;
  status: string;
  amount: number;
  currency: string;
  note: string;
  occurred_at: string;
  sender: OpenLedgerParty;
  receiver: OpenLedgerParty;
  sender_amount: number | null;
  sender_currency: string | null;
  receiver_amount: number | null;
  receiver_currency: string | null;
};

/** Compact, shareable identity for an OpenLedger operation (API ids are often null). */
export type OpenLedgerOpRef = {
  at: string;
  from: string;
  to: string;
  amt: number;
  cur: string;
  note: string;
  sn: string;
  rn: string;
  sa: string;
  ra: string;
  st: string;
  et: string;
  sam?: number | null;
  scu?: string | null;
  ram?: number | null;
  rcu?: string | null;
};

export type OpenLedgerFeed = {
  source: string;
  version: string;
  generated_at: string;
  limit: number;
  offset: number;
  count: number;
  entries: OpenLedgerEntry[];
};

export type OpenLedgerQuery = {
  limit?: number;
  offset?: number;
  since?: string;
};

export function classifyOpenLedgerNote(note: string | null | undefined): string {
  const n = (note ?? "").toLowerCase();
  if (n.includes("stake claim")) return "stake_claim";
  if (n.includes("stake lock") || n.includes("stake")) return "stake";
  if (n.includes("wallet top up") || n.includes("pi ->") || n.includes("pi →")) return "topup";
  if (n.includes("swap")) return "swap";
  if (n.includes("payment") || n.includes("pay")) return "payment";
  if (n.trim()) return "transfer";
  return "transfer";
}

export function openLedgerEntryKey(entry: OpenLedgerEntry, index: number): string {
  return [
    entry.id ?? "null",
    entry.occurred_at,
    entry.sender?.username ?? "",
    entry.receiver?.username ?? "",
    entry.amount,
    index,
  ].join("|");
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  const b64 = typeof btoa === "function" ? btoa(bin) : Buffer.from(bytes).toString("base64");
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlToBytes(key: string): Uint8Array {
  const padded = key.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  const b64 = padded + pad;
  if (typeof atob === "function") {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  return new Uint8Array(Buffer.from(b64, "base64"));
}

export function entryToOpRef(entry: OpenLedgerEntry): OpenLedgerOpRef {
  return {
    at: entry.occurred_at,
    from: entry.sender?.username ?? "",
    to: entry.receiver?.username ?? "",
    amt: Number(entry.amount),
    cur: entry.currency || "OUSD",
    note: entry.note ?? "",
    sn: entry.sender?.name ?? "",
    rn: entry.receiver?.name ?? "",
    sa: entry.sender?.avatar_url ?? "",
    ra: entry.receiver?.avatar_url ?? "",
    st: entry.status ?? "",
    et: entry.event_type ?? "",
    sam: entry.sender_amount,
    scu: entry.sender_currency,
    ram: entry.receiver_amount,
    rcu: entry.receiver_currency,
  };
}

export function opRefToEntry(ref: OpenLedgerOpRef): OpenLedgerEntry {
  return {
    id: null,
    event_type: ref.et || "transaction_created",
    status: ref.st || "completed",
    amount: Number(ref.amt),
    currency: ref.cur || "OUSD",
    note: ref.note || "",
    occurred_at: ref.at,
    sender: { name: ref.sn || ref.from, username: ref.from, avatar_url: ref.sa || "" },
    receiver: { name: ref.rn || ref.to, username: ref.to, avatar_url: ref.ra || "" },
    sender_amount: ref.sam ?? null,
    sender_currency: ref.scu ?? null,
    receiver_amount: ref.ram ?? null,
    receiver_currency: ref.rcu ?? null,
  };
}

export function encodeOpenLedgerOpKey(entry: OpenLedgerEntry): string {
  const json = JSON.stringify(entryToOpRef(entry));
  return bytesToBase64Url(new TextEncoder().encode(json));
}

export function decodeOpenLedgerOpKey(key: string): OpenLedgerEntry | null {
  try {
    const json = new TextDecoder().decode(base64UrlToBytes(decodeURIComponent(key)));
    const ref = JSON.parse(json) as OpenLedgerOpRef;
    if (!ref?.at || ref.amt == null) return null;
    return opRefToEntry(ref);
  } catch {
    return null;
  }
}

export function matchesOpenLedgerEntry(a: OpenLedgerEntry, b: OpenLedgerEntry): boolean {
  return (
    a.occurred_at === b.occurred_at &&
    Number(a.amount) === Number(b.amount) &&
    (a.currency || "OUSD") === (b.currency || "OUSD") &&
    (a.sender?.username ?? "") === (b.sender?.username ?? "") &&
    (a.receiver?.username ?? "") === (b.receiver?.username ?? "")
  );
}

export async function fetchOpenLedgerFeed(query: OpenLedgerQuery = {}): Promise<OpenLedgerFeed> {
  const u = new URL(OPENLEDGER_TESTNET_API);
  const limit = Math.min(500, Math.max(1, query.limit ?? 50));
  const offset = Math.max(0, query.offset ?? 0);
  u.searchParams.set("limit", String(limit));
  u.searchParams.set("offset", String(offset));
  if (query.since) u.searchParams.set("since", query.since);

  const res = await fetch(u.toString(), { headers: { Accept: "application/json" } });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`OpenLedger API ${res.status}: ${body.slice(0, 200) || res.statusText}`);
  }
  return res.json() as Promise<OpenLedgerFeed>;
}

/** Scan the public feed for a matching entry (ids are often null). */
export async function findOpenLedgerEntry(target: OpenLedgerEntry, maxPages = 8): Promise<OpenLedgerEntry | null> {
  const pageSize = 100;
  for (let page = 0; page < maxPages; page++) {
    const feed = await fetchOpenLedgerFeed({ limit: pageSize, offset: page * pageSize });
    const hit = feed.entries.find((e) => matchesOpenLedgerEntry(e, target));
    if (hit) return hit;
    if (feed.count < pageSize) break;
  }
  return null;
}
