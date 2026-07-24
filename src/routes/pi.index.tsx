import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, ChevronLeft, ChevronRight, ExternalLink, Globe2 } from "lucide-react";
import { z } from "zod";

import { CopyButton } from "@/components/copy-button";
import { PageLoader } from "@/components/page-loader";
import { StatCard } from "@/components/stat-card";
import {
  assetLabel,
  cursorFromHref,
  nativeBalance,
  OPENPAY_TESTNET_ACCOUNT,
  PI_TESTNET_HORIZON,
  type PiAccount,
  type PiHorizonPage,
  type PiPayment,
  type PiTransaction,
} from "@/lib/pi-horizon";
import { formatInt, formatNumber, fullDate, shortAddress, shortHash, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";

const searchSchema = z.object({
  tab: z.enum(["payments", "transactions"]).optional().catch("payments"),
  cursor: z.string().optional().catch(undefined),
});

export const Route = createFileRoute("/pi/")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Pi Testnet Explorer — OpenPay OUSD — OpenLedger" },
      {
        name: "description",
        content:
          "Live Pi Network Testnet block explorer for the OpenPay OUSD settlement account — balance, payments, and transactions from Horizon.",
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
  const { tab = "payments", cursor } = Route.useSearch();
  const navigate = Route.useNavigate();
  const accountId = OPENPAY_TESTNET_ACCOUNT;

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

  const page = tab === "payments" ? payments : transactions;
  const nextCursor = cursorFromHref(page.data?._links?.next?.href);
  const prevCursor = cursorFromHref(page.data?._links?.prev?.href);
  const balance = nativeBalance(account.data);
  const horizonAccountUrl = `${PI_TESTNET_HORIZON}/accounts/${accountId}`;

  const setTab = (next: "payments" | "transactions") =>
    navigate({ to: "/pi/", search: { tab: next, cursor: undefined } });

  const goCursor = (c: string | null | undefined) =>
    navigate({
      to: "/pi/",
      search: (prev) => ({ ...prev, cursor: c || undefined }),
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
            <span className="rounded-md bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-600 dark:text-amber-400">
              Testnet
            </span>
            <span className="rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
              OUSD · OpenPay
            </span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">OpenPay Testnet Account</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Live chain activity for the OpenPay OUSD settlement wallet on Pi Network Testnet (1 Test-PI ≈ 1 OUSD).
          </p>
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
          label="Balance"
          value={`${formatNumber(balance)} Test-PI`}
          sub="Native · ≈ OUSD peg"
          loading={account.isLoading}
        />
        <StatCard
          label="Last ledger"
          value={account.data ? `#${formatInt(account.data.last_modified_ledger)}` : "—"}
          sub={account.data ? timeAgo(account.data.last_modified_time) : undefined}
          loading={account.isLoading}
        />
        <StatCard
          label="Sequence"
          value={account.data ? shortHash(account.data.sequence, 6, 4) : "—"}
          sub={account.data ? fullDate(account.data.last_modified_time) : undefined}
          loading={account.isLoading}
        />
        <StatCard
          label="Subentries"
          value={formatInt(account.data?.subentry_count ?? 0)}
          sub={`${account.data?.signers?.length ?? 0} signer(s)`}
          loading={account.isLoading}
        />
      </div>

      <div className="flex flex-wrap gap-1 border-b border-border pb-px">
        {(
          [
            { id: "payments" as const, label: "Payments" },
            { id: "transactions" as const, label: "Transactions" },
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
            {tab === "payments" ? "Payment operations" : "Account transactions"}
            <span className="ml-2 text-xs font-normal text-muted-foreground">Pi Horizon · newest first</span>
          </h2>
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
        </div>

        {page.isLoading && !page.data ? (
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
  if (!rows.length) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
        No payments found for this account.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card">
      <ul className="divide-y divide-border sm:hidden">
        {rows.map((p) => {
          const inbound = p.to === focus;
          return (
            <li key={p.id} className="space-y-2 px-4 py-3">
              <div className="flex items-start justify-between gap-2">
                <Link
                  to="/pi/tx/$hash"
                  params={{ hash: p.transaction_hash }}
                  className="font-mono text-xs text-primary hover:underline break-all"
                >
                  {shortHash(p.transaction_hash, 10, 8)}
                </Link>
                <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(p.created_at)}</span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <span
                  className={cn(
                    "rounded-md px-1.5 py-0.5 font-medium",
                    inbound ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-orange-500/10 text-orange-600 dark:text-orange-400",
                  )}
                >
                  {inbound ? "In" : "Out"}
                </span>
                <StatusDot ok={p.transaction_successful} />
              </div>
              <div className="flex items-center gap-2 text-xs min-w-0">
                <span className="font-mono text-muted-foreground truncate">{shortAddress(p.from)}</span>
                <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground" />
                <span className="font-mono text-muted-foreground truncate">{shortAddress(p.to)}</span>
              </div>
              <div className="text-sm font-semibold tabular-nums">
                {formatNumber(p.amount)} {assetLabel(p)}
              </div>
            </li>
          );
        })}
      </ul>

      <div className="table-scroll hidden sm:block">
        <table className="w-full min-w-180 text-sm">
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
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => {
              const inbound = p.to === focus;
              return (
                <tr key={p.id} className="border-t border-border hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <Link
                      to="/pi/tx/$hash"
                      params={{ hash: p.transaction_hash }}
                      className="font-mono text-xs text-primary hover:underline"
                    >
                      {shortHash(p.transaction_hash, 8, 6)}
                    </Link>
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
                    <StatusDot ok={p.transaction_successful} />
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{timeAgo(p.created_at)}</td>
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
  if (!rows.length) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
        No transactions found for this account.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card">
      <ul className="divide-y divide-border sm:hidden">
        {rows.map((tx) => (
          <li key={tx.hash} className="space-y-2 px-4 py-3">
            <div className="flex items-start justify-between gap-2">
              <Link
                to="/pi/tx/$hash"
                params={{ hash: tx.hash }}
                className="font-mono text-xs text-primary hover:underline break-all"
              >
                {shortHash(tx.hash, 10, 8)}
              </Link>
              <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(tx.created_at)}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <StatusDot ok={tx.successful} />
              <span className="text-muted-foreground">Ledger #{formatInt(tx.ledger)}</span>
              <span className="text-muted-foreground">{tx.operation_count} op(s)</span>
            </div>
            {tx.memo ? (
              <div className="truncate text-xs text-muted-foreground">
                Memo: <span className="font-mono text-foreground">{tx.memo}</span>
              </div>
            ) : null}
          </li>
        ))}
      </ul>

      <div className="table-scroll hidden sm:block">
        <table className="w-full min-w-180 text-sm">
          <thead className="bg-muted/50 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Tx Hash</th>
              <th className="px-4 py-3 font-medium">Ledger</th>
              <th className="px-4 py-3 font-medium">Source</th>
              <th className="px-4 py-3 font-medium">Ops</th>
              <th className="px-4 py-3 font-medium">Memo</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Age</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((tx) => (
              <tr key={tx.hash} className="border-t border-border hover:bg-muted/30">
                <td className="px-4 py-3">
                  <Link
                    to="/pi/tx/$hash"
                    params={{ hash: tx.hash }}
                    className="font-mono text-xs text-primary hover:underline"
                  >
                    {shortHash(tx.hash, 8, 6)}
                  </Link>
                </td>
                <td className="px-4 py-3 font-mono text-xs">#{formatInt(tx.ledger)}</td>
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                  {shortAddress(tx.source_account)}
                </td>
                <td className="px-4 py-3 tabular-nums">{tx.operation_count}</td>
                <td className="px-4 py-3 max-w-40 truncate font-mono text-xs text-muted-foreground">
                  {tx.memo || "—"}
                </td>
                <td className="px-4 py-3">
                  <StatusDot ok={tx.successful} />
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{timeAgo(tx.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
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
