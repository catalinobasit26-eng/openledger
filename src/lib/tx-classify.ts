/** Shared OpenPay → OpenLedger type inference */

export type TxType =
  | "payment" | "transfer" | "swap" | "nft_mint" | "nft_sale"
  | "merchant_payment" | "withdrawal" | "deposit" | "refund" | "stake";

const OPENPAY_CATEGORY_MAP: Record<string, TxType> = {
  topup: "deposit",
  withdraw: "withdrawal",
  swap: "swap",
  nft: "nft_sale",
  staking: "stake",
  loan: "transfer",
  affiliate: "payment",
  mining: "deposit",
  other: "payment",
};

/** Paid 1.00 PI → 1.00 OUSD (different currencies) = swap */
const PAID_ARROW_RE =
  /Paid\s+[\d,.]+\s+([A-Za-z]+)\s*(?:\u2192|->)\s*[\d,.]+\s+([A-Za-z]+)/i;

const STAKE_NOTE_RE = /^(stake|unstake)\b|\bstaking\b|\bunstake\b/i;

export function isCurrencySwapNote(note: string | null | undefined): boolean {
  if (!note) return false;
  const m = note.match(PAID_ARROW_RE);
  if (!m) return false;
  return m[1].toUpperCase() !== m[2].toUpperCase();
}

export function isStakeNote(note: string | null | undefined): boolean {
  if (!note) return false;
  return STAKE_NOTE_RE.test(note);
}

/** True for typed stake rows or legacy staking transfers/payments identified via metadata. */
export function isStakeTx(row: {
  type?: string | null;
  metadata?: { category?: string | null; note?: string | null; event_type?: string | null } | null;
}): boolean {
  if (String(row.type ?? "").toLowerCase() === "stake") return true;
  const meta = row.metadata ?? {};
  if (String(meta.category ?? "").toLowerCase() === "staking") return true;
  if (isStakeNote(meta.note)) return true;
  if (/stake/i.test(String(meta.event_type ?? ""))) return true;
  return false;
}

export function effectiveTxType(type: string | null | undefined, note?: string | null): string {
  if (type === "swap" || isCurrencySwapNote(note)) return "swap";
  if (type === "stake" || isStakeNote(note)) return "stake";
  return type || "payment";
}

export function inferOpenPayTxType(item: {
  category?: string | null;
  event_type?: string | null;
  note?: string | null;
  sender_currency_code?: string | null;
  receiver_currency_code?: string | null;
}): TxType {
  const category = String(item.category ?? "other").toLowerCase();
  const eventType = String(item.event_type ?? "").toLowerCase();
  const note = String(item.note ?? "");

  if (category === "swap" || isCurrencySwapNote(note)) return "swap";

  const sc = item.sender_currency_code ? String(item.sender_currency_code).toUpperCase() : "";
  const rc = item.receiver_currency_code ? String(item.receiver_currency_code).toUpperCase() : "";
  if (sc && rc && sc !== rc) return "swap";

  if (/wallet top up|top\s*up\s*\(/i.test(note) || category === "topup") return "deposit";
  if (category === "staking" || isStakeNote(note) || eventType.includes("stake")) return "stake";
  if (eventType.includes("nft") || category === "nft") return "nft_sale";

  return OPENPAY_CATEGORY_MAP[category] ?? "payment";
}

