import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, ChevronLeft, ChevronRight, ExternalLink, Globe2 } from "lucide-react";
import { z } from "zod";

import { CopyButton } from "@/components/copy-button";
import { PageLoader } from "@/components/page-loader";
import { StatCard } from "@/components/stat-card";
import { NetworkBadge, TypeBadge } from "@/components/badges";
import {
  assetLabel,
  creditBalance,
  cursorFromHref,
  nativeBalance,
  notableCreditBalances,
  OPENPAY_PI_WALLETS,
  PI_TESTNET_HORIZON,
  resolvePiWallet,
  type PiAccount,
  type PiHorizonPage,
  type PiPayment,
  type PiTransaction,
} from "@/lib/pi-horizon";
import {
  classifyOpenLedgerNote,
  encodeOpenLedgerOpKey,
  OPENLEDGER_TESTNET_API,
  openLedgerEntryKey,
  type OpenLedgerEntry,
  type OpenLedgerFeed,
} from "@/lib/openledger-api";
import { formatAmount, formatInt, formatNumber, shortAddress, shortHash, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";

const OPS_PAGE_SIZE = 50;

const searchSchema = z.object({
  wallet: z.string().optional().catch(undefined),
  tab: z.enum(["payments", "transactions", "operations"]).optional().catch("payments"),
  cursor: z.string().optional().catch(undefined),
  offset: z.coerce.number().int().min(0).optional().catch(0),
});

export const Route = createFileRoute("/pi/")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Pi Testnet Explorer — OpenPay OUSD — OpenLedger" },
      {
        name: "description",
        content:
          "Live Pi Network Testnet block explorer for the OpenPay OUSD settlement account — Horizon chain activity plus OpenLedger operations.",
      },
    ],
  }),
  component: PiExplorerPage,
});

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error || `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

function PiExplorerPage() {
  const { wallet: walletParam, tab = "payments", cursor, offset: offsetRaw } = Route.useSearch();
  const navigate = Route.useNavigate();
  const wallet = resolvePiWallet(walletParam);
  const accountId = wallet.id;
  const opsOffset = Math.max(0, Number(offsetRaw ?? 0));
  const isHorizonTab = tab === "payments" || tab === "transactions";

  const account = useQuery({
    queryKey: ["pi-account", accountId],
    queryFn: () => getJson<PiAccount>(`/api/public/pi/account?account=${encodeURIComponent(accountId)}`),
    refetchInterval: 20_000,
  });

  const payments = useQuery({
    enabled: tab === "payments",
    queryKey: ["pi-payments", accountId, cursor ?? ""],
    queryFn: () => {
      const q = new URLSearchParams({ account: accountId, limit: "25", order: "desc" });
      if (cursor) q.set("cursor", cursor);
      return getJson<PiHorizonPage<PiPayment>>(`/api/public/pi/payments?${q}`);
    },
    refetchInterval: 15_000,
  });

  const transactions = useQuery({
    enabled: tab === "transactions",
    queryKey: ["pi-transactions", accountId, cursor ?? ""],
    queryFn: () => {
      const q = new URLSearchParams({ account: accountId, limit: "25", order: "desc" });
      if (cursor) q.set("cursor", cursor);
      return getJson<PiHorizonPage<PiTransaction>>(`/api/public/pi/transactions?${q}`);
    },
    refetchInterval: 15_000,
  });

  const operations = useQuery({
    enabled: tab === "operations",
    queryKey: ["pi-operations", opsOffset],
    queryFn: () => {
      const q = new URLSearchParams({
        limit: String(OPS_PAGE_SIZE),
        offset: String(opsOffset),
      });
      return getJson<OpenLedgerFeed>(`/api/public/pi/operations?${q}`);
    },
    refetchInterval: 15_000,
  });

  const page = tab === "payments" ? payments : transactions;
  const nextCursor = cursorFromHref(page.data?._links?.next?.href);
  const prevCursor = cursorFromHref(page.data?._links?.prev?.href);
  const opsCount = operations.data?.count ?? 0;
  const hasOlderOps = opsCount >= OPS_PAGE_SIZE;
  const hasNewerOps = opsOffset > 0;
  const balance = nativeBalance(account.data);
  const ousdBalance = creditBalance(account.data, "OUSD");
  const credits = notableCreditBalances(account.data, 5);
  const horizonAccountUrl = `${PI_TESTNET_HORIZON}/accounts/${accountId}`;

  const setWallet = (id: string) =>
    navigate({
      to: "/pi",
      search: { wallet: id, tab, cursor: undefined, offset: 0 },
    });

  const setTab = (next: "payments" | "transactions" | "operations") =>
    navigate({
      to: "/pi",
      search: (prev) => ({ ...prev, tab: next, cursor: undefined, offset: 0 }),
    });

  const goCursor = (c: string | null | undefined) =>
    navigate({
      to: "/pi",
      search: (prev) => ({ ...prev, cursor: c || undefined }),
    });

  const goOpsOffset = (next: number) =>
    navigate({
      to: "/pi",
      search: (prev) => ({ ...prev, offset: Math.max(0, next) }),
    });

  if (account.isLoading && !account.data) {
    return <PageLoader label="Loading Pi Testnet account…" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
          <Globe2 className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs uppercase tracking-wider text-muted-foreground">Pi Block Explorer</span>
            <NetworkBadge network="testnet" />
            <span className="rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
              OUSD · OpenPay
            </span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">OpenPay · {wallet.label}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {wallet.description} on Pi Network Testnet (
            <a
              href={horizonAccountUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Horizon
            </a>
            ).
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {OPENPAY_PI_WALLETS.map((w) => (
              <button
                key={w.id}
                type="button"
                onClick={() => setWallet(w.id)}
                className={cn(
                  "rounded-md border px-2.5 py-1 text-xs font-medium transition",
                  w.id === accountId
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-border bg-background text-muted-foreground hover:text-foreground",
                )}
              >
                {w.shortLabel}
              </button>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <code className="break-all rounded-md bg-muted px-2.5 py-1.5 font-mono text-xs sm:text-sm">
              {accountId}
            </code>
            <CopyButton value={accountId} />
            <a
              href={horizonAccountUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              Horizon <ExternalLink className="h-3 w-3" />
            </a>
            <a
              href={`${OPENLEDGER_TESTNET_API}?limit=50`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              OpenLedger API <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      </div>

      {account.isError ? (
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          {account.error instanceof Error ? account.error.message : "Failed to load account"}
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          label="OUSD"
          value={formatNumber(ousdBalance)}
          sub="Credit asset on Pi Testnet"
          loading={account.isLoading}
        />
        <StatCard
          label="Test-PI"
          value={formatNumber(balance)}
          sub="Native balance"
          loading={account.isLoading}
        />
        <StatCard
          label="Last ledger"
          value={account.data ? `#${formatInt(account.data.last_modified_ledger)}` : "—"}
          sub={account.data ? timeAgo(account.data.last_modified_time) : undefined}
          loading={account.isLoading}
        />
        <StatCard
          label="Subentries"
          value={formatInt(account.data?.subentry_count ?? 0)}
          sub={`${account.data?.signers?.length ?? 0} signer(s)`}
          loading={account.isLoading}
        />
      </div>

      {credits.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {credits.map((b) => (
            <span
              key={`${b.asset_code}-${b.asset_issuer}`}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1 text-xs"
            >
              <span className="font-medium text-muted-foreground">{b.asset_code}</span>
              <span className="font-semibold tabular-nums">{formatNumber(b.balance)}</span>
            </span>
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-1 border-b border-border pb-px">
        {(
          [
            { id: "payments" as const, label: "Payments" },
            { id: "transactions" as const, label: "Transactions" },
            { id: "operations" as const, label: "Operations" },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "rounded-t-md px-4 py-2 text-sm transition",
              tab === t.id
                ? "border border-b-0 border-border bg-card font-medium text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">
            {tab === "payments"
              ? "Payment operations"
              : tab === "transactions"
                ? "Account transactions"
                : "OpenLedger operations"}
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              {tab === "operations"
                ? `OpenPay testnet feed · offset ${opsOffset}`
                : "Pi Horizon · newest first"}
            </span>
          </h2>
          {isHorizonTab ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => goCursor(undefined)}
                disabled={!cursor}
                className="rounded-md border border-border bg-card px-2.5 py-1 text-xs disabled:opacity-40 hover:border-primary/40"
              >
                Newest
              </button>
              <button
                type="button"
                onClick={() => goCursor(prevCursor)}
                disabled={!prevCursor || page.isFetching}
                className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2.5 py-1 text-xs disabled:opacity-40 hover:border-primary/40"
              >
                <ChevronLeft className="h-3.5 w-3.5" /> Newer
              </button>
              <button
                type="button"
                onClick={() => goCursor(nextCursor)}
                disabled={!nextCursor || page.isFetching}
                className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2.5 py-1 text-xs disabled:opacity-40 hover:border-primary/40"
              >
                Older <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => goOpsOffset(0)}
                disabled={!hasNewerOps}
                className="rounded-md border border-border bg-card px-2.5 py-1 text-xs disabled:opacity-40 hover:border-primary/40"
              >
                Newest
              </button>
              <button
                type="button"
                onClick={() => goOpsOffset(opsOffset - OPS_PAGE_SIZE)}
                disabled={!hasNewerOps || operations.isFetching}
                className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2.5 py-1 text-xs disabled:opacity-40 hover:border-primary/40"
              >
                <ChevronLeft className="h-3.5 w-3.5" /> Newer
              </button>
              <button
                type="button"
                onClick={() => goOpsOffset(opsOffset + OPS_PAGE_SIZE)}
                disabled={!hasOlderOps || operations.isFetching}
                className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2.5 py-1 text-xs disabled:opacity-40 hover:border-primary/40"
              >
                Older <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>

        {tab === "operations" ? (
          operations.isLoading && !operations.data ? (
            <PageLoader label="Loading OpenLedger operations…" className="min-h-[30vh]" />
          ) : operations.isError ? (
            <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
              {operations.error instanceof Error ? operations.error.message : "Failed to load"}
            </div>
          ) : (
            <OperationsTable
              rows={operations.data?.entries ?? []}
              generatedAt={operations.data?.generated_at}
              source={operations.data?.source}
            />
          )
        ) : page.isLoading && !page.data ? (
          <PageLoader label={`Loading ${tab}…`} className="min-h-[30vh]" />
        ) : page.isError ? (
          <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
            {page.error instanceof Error ? page.error.message : "Failed to load"}
          </div>
        ) : tab === "payments" ? (
          <PaymentsTable rows={payments.data?._embedded?.records ?? []} focus={accountId} />
        ) : (
          <TransactionsTable rows={transactions.data?._embedded?.records ?? []} />
        )}
      </section>
    </div>
  );
}

function PaymentsTable({ rows, focus }: { rows: PiPayment[]; focus: string }) {
  const navigate = useNavigate();

  if (!rows.length) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
        No payments found for this account.
      </div>
    );
  }

  const openTx = (hash: string) => {
    void navigate({ to: "/pi/tx/$hash", params: { hash } });
  };

  return (
    <div className="rounded-xl border border-border bg-card">
      <ul className="divide-y divide-border sm:hidden">
        {rows.map((p) => {
          const inbound = p.to === focus;
          return (
            <li key={p.id}>
              <Link
                to="/pi/tx/$hash"
                params={{ hash: p.transaction_hash }}
                className="block space-y-2 px-4 py-3 transition hover:bg-muted/40"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-mono text-xs text-primary break-all">
                    {shortHash(p.transaction_hash, 10, 8)}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(p.created_at)}</span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  <span
                    className={cn(
                      "rounded-md px-1.5 py-0.5 font-medium",
                      inbound
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : "bg-orange-500/10 text-orange-600 dark:text-orange-400",
                    )}
                  >
                    {inbound ? "In" : "Out"}
                  </span>
                  <NetworkBadge network="testnet" />
                  <StatusDot ok={p.transaction_successful} />
                </div>
                <div className="flex items-center gap-2 text-xs min-w-0">
                  <span className="font-mono text-muted-foreground truncate">{shortAddress(p.from)}</span>
                  <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground" />
                  <span className="font-mono text-muted-foreground truncate">{shortAddress(p.to)}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-semibold tabular-nums">
                    {formatNumber(p.amount)} {assetLabel(p)}
                  </div>
                  <span className="shrink-0 rounded-md bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary">
                    View →
                  </span>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="table-scroll hidden sm:block">
        <table className="w-full min-w-5xl text-sm">
          <thead className="bg-muted/50 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Tx Hash</th>
              <th className="px-4 py-3 font-medium">Dir</th>
              <th className="px-4 py-3 font-medium">From</th>
              <th className="px-4 py-3 font-medium" />
              <th className="px-4 py-3 font-medium">To</th>
              <th className="px-4 py-3 font-medium text-right">Amount</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Age</th>
              <th className="sticky right-0 z-10 bg-muted/95 px-3 py-3 font-medium text-right shadow-[-8px_0_12px_-8px_rgba(0,0,0,0.15)] backdrop-blur-sm">
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => {
              const inbound = p.to === focus;
              return (
                <tr
                  key={p.id}
                  role="link"
                  tabIndex={0}
                  onClick={() => openTx(p.transaction_hash)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      openTx(p.transaction_hash);
                    }
                  }}
                  className="border-t border-border hover:bg-muted/30 cursor-pointer group"
                >
                  <td className="px-4 py-3 font-mono text-xs text-primary">
                    {shortHash(p.transaction_hash, 8, 6)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "rounded-md px-1.5 py-0.5 text-[11px] font-medium",
                        inbound
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          : "bg-orange-500/10 text-orange-600 dark:text-orange-400",
                      )}
                    >
                      {inbound ? "In" : "Out"}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{shortAddress(p.from)}</td>
                  <td className="px-2 py-3">
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{shortAddress(p.to)}</td>
                  <td className="px-4 py-3 text-right font-medium tabular-nums">
                    {formatNumber(p.amount)} {assetLabel(p)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-1">
                      <NetworkBadge network="testnet" />
                      <StatusDot ok={p.transaction_successful} />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{timeAgo(p.created_at)}</td>
                  <td className="sticky right-0 z-10 bg-card px-3 py-3 text-right shadow-[-8px_0_12px_-8px_rgba(0,0,0,0.12)] group-hover:bg-muted/80">
                    <span className="inline-flex items-center rounded-md bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary whitespace-nowrap">
                      View
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TransactionsTable({ rows }: { rows: PiTransaction[] }) {
  const navigate = useNavigate();

  if (!rows.length) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
        No transactions found for this account.
      </div>
    );
  }

  const openTx = (hash: string) => {
    void navigate({ to: "/pi/tx/$hash", params: { hash } });
  };

  return (
    <div className="rounded-xl border border-border bg-card">
      <ul className="divide-y divide-border sm:hidden">
        {rows.map((tx) => (
          <li key={tx.hash}>
            <Link
              to="/pi/tx/$hash"
              params={{ hash: tx.hash }}
              className="block space-y-2 px-4 py-3 transition hover:bg-muted/40"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-mono text-xs text-primary break-all">{shortHash(tx.hash, 10, 8)}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(tx.created_at)}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <NetworkBadge network="testnet" />
                <StatusDot ok={tx.successful} />
                <span className="text-muted-foreground">Ledger #{formatInt(tx.ledger)}</span>
                <span className="text-muted-foreground">{tx.operation_count} op(s)</span>
              </div>
              {tx.memo ? (
                <div className="truncate text-xs text-muted-foreground">
                  Memo: <span className="font-mono text-foreground">{tx.memo}</span>
                </div>
              ) : null}
              <div className="flex justify-end">
                <span className="rounded-md bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary">
                  View →
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>

      <div className="table-scroll hidden sm:block">
        <table className="w-full min-w-5xl text-sm">
          <thead className="bg-muted/50 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Tx Hash</th>
              <th className="px-4 py-3 font-medium">Ledger</th>
              <th className="px-4 py-3 font-medium">Source</th>
              <th className="px-4 py-3 font-medium">Ops</th>
              <th className="px-4 py-3 font-medium">Memo</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Age</th>
              <th className="sticky right-0 z-10 bg-muted/95 px-3 py-3 font-medium text-right shadow-[-8px_0_12px_-8px_rgba(0,0,0,0.15)] backdrop-blur-sm">
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((tx) => (
              <tr
                key={tx.hash}
                role="link"
                tabIndex={0}
                onClick={() => openTx(tx.hash)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    openTx(tx.hash);
                  }
                }}
                className="border-t border-border hover:bg-muted/30 cursor-pointer group"
              >
                <td className="px-4 py-3 font-mono text-xs text-primary">{shortHash(tx.hash, 8, 6)}</td>
                <td className="px-4 py-3 font-mono text-xs">#{formatInt(tx.ledger)}</td>
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                  {shortAddress(tx.source_account)}
                </td>
                <td className="px-4 py-3 tabular-nums">{tx.operation_count}</td>
                <td className="px-4 py-3 max-w-40 truncate font-mono text-xs text-muted-foreground">
                  {tx.memo || "—"}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-1">
                    <NetworkBadge network="testnet" />
                    <StatusDot ok={tx.successful} />
                  </div>
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{timeAgo(tx.created_at)}</td>
                <td className="sticky right-0 z-10 bg-card px-3 py-3 text-right shadow-[-8px_0_12px_-8px_rgba(0,0,0,0.12)] group-hover:bg-muted/80">
                  <span className="inline-flex items-center rounded-md bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary whitespace-nowrap">
                    View
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PartyCell({ party }: { party: OpenLedgerEntry["sender"] }) {
  const initial = (party?.name || party?.username || "?").slice(0, 1).toUpperCase();
  return (
    <div className="flex items-center gap-2 min-w-0">
      {party?.avatar_url ? (
        <img
          src={party.avatar_url}
          alt=""
          className="h-7 w-7 shrink-0 rounded-full object-cover bg-muted"
          loading="lazy"
        />
      ) : (
        <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground">
          {initial}
        </div>
      )}
      <div className="min-w-0">
        <div className="truncate text-sm font-medium leading-tight">{party?.name || "—"}</div>
        <div className="truncate text-[11px] text-muted-foreground">@{party?.username || "unknown"}</div>
      </div>
    </div>
  );
}

function OpsStatus({ status }: { status: string }) {
  const ok = status.toLowerCase() === "completed" || status.toLowerCase() === "success";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium capitalize",
        ok ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-muted text-muted-foreground",
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", ok ? "bg-emerald-500" : "bg-muted-foreground")} />
      {status || "unknown"}
    </span>
  );
}

function OperationsTable({
  rows,
  generatedAt,
  source,
}: {
  rows: OpenLedgerEntry[];
  generatedAt?: string;
  source?: string;
}) {
  const navigate = useNavigate();

  if (!rows.length) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
        No OpenLedger operations found.
      </div>
    );
  }

  const openOp = (key: string) => {
    void navigate({ to: "/pi/op/$key", params: { key } });
  };

  return (
    <div className="space-y-2">
      {(generatedAt || source) && (
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
          {source ? (
            <span className="rounded-md border border-border bg-muted px-1.5 py-0.5 font-medium uppercase tracking-wide">
              {source}
            </span>
          ) : null}
          {generatedAt ? <span>Feed generated {timeAgo(generatedAt)}</span> : null}
          <span>· {rows.length} entries</span>
        </div>
      )}

      <div className="rounded-xl border border-border bg-card">
        <ul className="divide-y divide-border sm:hidden">
          {rows.map((op, i) => {
            const kind = classifyOpenLedgerNote(op.note);
            const key = encodeOpenLedgerOpKey(op);
            return (
              <li key={openLedgerEntryKey(op, i)}>
                <Link
                  to="/pi/op/$key"
                  params={{ key }}
                  className="block space-y-2 px-4 py-3 transition hover:bg-muted/40"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <TypeBadge type={kind} />
                      <NetworkBadge network="testnet" />
                      <OpsStatus status={op.status} />
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(op.occurred_at)}</span>
                  </div>
                  <div className="flex items-center gap-2 min-w-0">
                    <PartyCell party={op.sender} />
                    <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground" />
                    <PartyCell party={op.receiver} />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-semibold tabular-nums text-primary">
                      {formatAmount(op.amount, op.currency || "OUSD")}
                    </div>
                    <span className="shrink-0 rounded-md bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary">
                      View →
                    </span>
                  </div>
                  {op.note ? <div className="text-xs text-muted-foreground line-clamp-2">{op.note}</div> : null}
                </Link>
              </li>
            );
          })}
        </ul>

        <div className="table-scroll hidden sm:block">
          <table className="w-full min-w-5xl text-sm">
            <thead className="bg-muted/50 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">From</th>
                <th className="px-4 py-3 font-medium" />
                <th className="px-4 py-3 font-medium">To</th>
                <th className="px-4 py-3 font-medium text-right">Amount</th>
                <th className="px-4 py-3 font-medium">Note</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Age</th>
                <th className="sticky right-0 z-10 bg-muted/95 px-3 py-3 font-medium text-right shadow-[-8px_0_12px_-8px_rgba(0,0,0,0.15)] backdrop-blur-sm">
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((op, i) => {
                const kind = classifyOpenLedgerNote(op.note);
                const key = encodeOpenLedgerOpKey(op);
                return (
                  <tr
                    key={openLedgerEntryKey(op, i)}
                    role="link"
                    tabIndex={0}
                    onClick={() => openOp(key)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        openOp(key);
                      }
                    }}
                    className="border-t border-border hover:bg-muted/30 cursor-pointer group"
                  >
                    <td className="px-4 py-3">
                      <TypeBadge type={kind} />
                    </td>
                    <td className="px-4 py-3">
                      <PartyCell party={op.sender} />
                    </td>
                    <td className="px-2 py-3">
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                    </td>
                    <td className="px-4 py-3">
                      <PartyCell party={op.receiver} />
                    </td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums whitespace-nowrap text-primary">
                      {formatNumber(op.amount)} {op.currency || "OUSD"}
                    </td>
                    <td className="px-4 py-3 max-w-48 truncate text-xs text-muted-foreground" title={op.note || undefined}>
                      {op.note || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-1">
                        <NetworkBadge network="testnet" />
                        <OpsStatus status={op.status} />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {timeAgo(op.occurred_at)}
                    </td>
                    <td className="sticky right-0 z-10 bg-card px-3 py-3 text-right shadow-[-8px_0_12px_-8px_rgba(0,0,0,0.12)] group-hover:bg-muted/80">
                      <span className="inline-flex items-center rounded-md bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary whitespace-nowrap">
                        View
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium",
        ok ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-destructive/10 text-destructive",
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", ok ? "bg-emerald-500" : "bg-destructive")} />
      {ok ? "Success" : "Failed"}
    </span>
  );
}
