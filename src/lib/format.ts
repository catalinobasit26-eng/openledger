import { formatDistanceToNow, format } from "date-fns";

export function shortHash(hash: string | null | undefined, head = 6, tail = 4): string {
  if (!hash) return "—";
  if (hash.length <= head + tail + 1) return hash;
  return `${hash.slice(0, head)}…${hash.slice(-tail)}`;
}

export function shortAddress(addr: string | null | undefined): string {
  return shortHash(addr, 6, 4);
}

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
const num = new Intl.NumberFormat("en-US", { maximumFractionDigits: 4 });
const numInt = new Intl.NumberFormat("en-US");

export function formatUsd(v: number | string | null | undefined): string {
  const n = typeof v === "string" ? Number(v) : v ?? 0;
  if (!Number.isFinite(n)) return "$0.00";
  return usd.format(n);
}
export function formatNumber(v: number | string | null | undefined): string {
  const n = typeof v === "string" ? Number(v) : v ?? 0;
  return num.format(n);
}
export function formatInt(v: number | string | null | undefined): string {
  const n = typeof v === "string" ? Number(v) : v ?? 0;
  return numInt.format(n);
}
export function formatAmount(v: number | string | null | undefined, currency = "OUSD"): string {
  return `${formatNumber(v)} ${currency}`;
}
export function timeAgo(ts: string | Date | null | undefined): string {
  if (!ts) return "—";
  try {
    return formatDistanceToNow(new Date(ts), { addSuffix: true });
  } catch {
    return "—";
  }
}
export function fullDate(ts: string | Date | null | undefined): string {
  if (!ts) return "—";
  try {
    return format(new Date(ts), "PPpp");
  } catch {
    return "—";
  }
}
