/** Shared OpenPay → OpenLedger type inference */

export type TxType =
  | "payment" | "transfer" | "swap" | "nft_mint" | "nft_sale"
  | "merchant_payment" | "withdrawal" | "deposit" | "refund";

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

/** Paid 1.00 PI → 1.00 OUSD (different currencies) = swap */
const PAID_ARROW_RE =
  /Paid\s+[\d,.]+\s+([A-Za-z]+)\s*(?:\u2192|->)\s*[\d,.]+\s+([A-Za-z]+)/i;

export function isCurrencySwapNote(note: string | null | undefined): boolean {
  if (!note) return false;
  const m = note.match(PAID_ARROW_RE);
  if (!m) return false;
  return m[1].toUpperCase() !== m[2].toUpperCase();
}

export function effectiveTxType(type: string | null | undefined, note?: string | null): string {
  if (type === "swap" || isCurrencySwapNote(note)) return "swap";
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
  if (/^stake\b/i.test(note) || category === "staking") return "transfer";
  if (eventType.includes("nft") || category === "nft") return "nft_sale";

  return OPENPAY_CATEGORY_MAP[category] ?? "payment";
}
