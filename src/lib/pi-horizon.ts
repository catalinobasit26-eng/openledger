/** Pi Network Horizon (Stellar-compatible) helpers for OpenPay testnet explorer. */

export const PI_TESTNET_HORIZON = "https://api.testnet.minepi.com";

/** OpenPay OUSD settlement account on Pi Testnet. */
export const OPENPAY_TESTNET_ACCOUNT =
  "GCJPFL6MPMZ7CWHNYNEAOKRZNIJXKKMNIFJEVJMJHN25JWM5A634XPAW";

/** OpenPay OUSD treasury / liquidity wallet on Pi Testnet. */
export const OPENPAY_TESTNET_TREASURY =
  "GDSXE723WPHZ5RGIJCSYXTPKSOIGPTSXE4RF5U3JTNGTCHXON7ZVD4LJ";

export type PiWatchedWallet = {
  id: string;
  label: string;
  shortLabel: string;
  description: string;
};

/** Watched OpenPay wallets on Pi Testnet (Horizon). */
export const OPENPAY_PI_WALLETS: PiWatchedWallet[] = [
  {
    id: OPENPAY_TESTNET_ACCOUNT,
    label: "Settlement",
    shortLabel: "Settlement",
    description: "OpenPay OUSD settlement account",
  },
  {
    id: OPENPAY_TESTNET_TREASURY,
    label: "OUSD Treasury",
    shortLabel: "Treasury",
    description: "OpenPay OUSD treasury / liquidity wallet",
  },
];

export function resolvePiWallet(accountId: string | null | undefined): PiWatchedWallet {
  const id = (accountId ?? "").trim();
  return OPENPAY_PI_WALLETS.find((w) => w.id === id) ?? OPENPAY_PI_WALLETS[0]!;
}

export function isOpenPayPiWallet(accountId: string | null | undefined): boolean {
  if (!accountId) return false;
  return OPENPAY_PI_WALLETS.some((w) => w.id === accountId);
}

export const PI_STROOPS_PER_UNIT = 10_000_000;

export type PiBalance = {
  balance: string;
  asset_type: string;
  asset_code?: string;
  asset_issuer?: string;
  buying_liabilities?: string;
  selling_liabilities?: string;
};

export type PiAccount = {
  id: string;
  account_id: string;
  sequence: string;
  subentry_count: number;
  last_modified_ledger: number;
  last_modified_time: string;
  balances: PiBalance[];
  thresholds: { low_threshold: number; med_threshold: number; high_threshold: number };
  flags: Record<string, boolean>;
  signers: { weight: number; key: string; type: string }[];
  paging_token: string;
};

export type PiPayment = {
  id: string;
  paging_token: string;
  transaction_successful: boolean;
  source_account: string;
  type: string;
  created_at: string;
  transaction_hash: string;
  asset_type: string;
  asset_code?: string;
  asset_issuer?: string;
  from: string;
  to: string;
  amount: string;
};

export type PiTransaction = {
  id: string;
  hash: string;
  paging_token: string;
  successful: boolean;
  ledger: number;
  created_at: string;
  source_account: string;
  fee_charged: string;
  max_fee: string;
  operation_count: number;
  memo?: string;
  memo_type?: string;
};

export type PiHorizonPage<T> = {
  _links: {
    self: { href: string };
    next?: { href: string };
    prev?: { href: string };
  };
  _embedded: { records: T[] };
};

export function nativeBalance(account: PiAccount | null | undefined): number {
  if (!account) return 0;
  const row = account.balances.find((b) => b.asset_type === "native");
  return row ? Number(row.balance) : 0;
}

/** Credit-asset balance by code (e.g. OUSD). Ignores liquidity pool shares. */
export function creditBalance(account: PiAccount | null | undefined, assetCode: string): number {
  if (!account) return 0;
  const code = assetCode.toUpperCase();
  const row = account.balances.find(
    (b) =>
      (b.asset_type === "credit_alphanum4" || b.asset_type === "credit_alphanum12") &&
      (b.asset_code ?? "").toUpperCase() === code,
  );
  return row ? Number(row.balance) : 0;
}

/** Non-zero credit balances for display (excludes LP shares + zero rows). */
export function notableCreditBalances(account: PiAccount | null | undefined, limit = 6): PiBalance[] {
  if (!account) return [];
  return account.balances
    .filter(
      (b) =>
        (b.asset_type === "credit_alphanum4" || b.asset_type === "credit_alphanum12") &&
        Number(b.balance) > 0,
    )
    .sort((a, b) => Number(b.balance) - Number(a.balance))
    .slice(0, limit);
}

export function assetLabel(p: { asset_type: string; asset_code?: string }): string {
  if (p.asset_type === "native") return "Test-PI";
  return p.asset_code ?? p.asset_type;
}

export function feeInPi(stroops: string | number): number {
  return Number(stroops) / PI_STROOPS_PER_UNIT;
}

export function cursorFromHref(href: string | undefined | null): string | null {
  if (!href) return null;
  try {
    const u = new URL(href);
    return u.searchParams.get("cursor");
  } catch {
    return null;
  }
}

type HorizonQuery = {
  cursor?: string;
  limit?: number;
  order?: "asc" | "desc";
};

function buildUrl(path: string, query?: HorizonQuery): string {
  const u = new URL(path, PI_TESTNET_HORIZON);
  if (query?.cursor) u.searchParams.set("cursor", query.cursor);
  if (query?.limit != null) u.searchParams.set("limit", String(query.limit));
  if (query?.order) u.searchParams.set("order", query.order);
  return u.toString();
}

async function horizonGet<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Pi Horizon ${res.status}: ${body.slice(0, 200) || res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export function fetchPiAccount(accountId = OPENPAY_TESTNET_ACCOUNT) {
  return horizonGet<PiAccount>(`${PI_TESTNET_HORIZON}/accounts/${accountId}`);
}

export function fetchPiPayments(accountId = OPENPAY_TESTNET_ACCOUNT, query: HorizonQuery = {}) {
  return horizonGet<PiHorizonPage<PiPayment>>(
    buildUrl(`/accounts/${accountId}/payments`, { limit: 25, order: "desc", ...query }),
  );
}

export function fetchPiTransactions(accountId = OPENPAY_TESTNET_ACCOUNT, query: HorizonQuery = {}) {
  return horizonGet<PiHorizonPage<PiTransaction>>(
    buildUrl(`/accounts/${accountId}/transactions`, { limit: 25, order: "desc", ...query }),
  );
}

export function fetchPiTransaction(hash: string) {
  return horizonGet<PiTransaction>(`${PI_TESTNET_HORIZON}/transactions/${hash}`);
}

export function fetchPiTransactionOperations(hash: string) {
  return horizonGet<PiHorizonPage<PiPayment & { type_i?: number }>>(
    buildUrl(`/transactions/${hash}/operations`, { limit: 50, order: "asc" }),
  );
}
