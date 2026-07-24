import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  ArrowRight,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Layers,
  Search,
} from "lucide-react";
import { z } from "zod";

import { CopyButton } from "@/components/copy-button";
import { PageLoader } from "@/components/page-loader";
import { StatCard } from "@/components/stat-card";
import { StatusBadge, TypeBadge } from "@/components/badges";
import {
  OPENPAY_PRO_APP_URL,
  OPENPAY_PRO_LEDGER_BASE_DEFAULT,
  proLedgerPublicBase,
  type ProLedgerEntriesResponse,
  type ProLedgerEntry,
  type ProLedgerStats,
} from "@/lib/openpay-pro-ledger";
import { formatAmount, formatInt, formatUsd, fullDate, shortAddress, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";

const TYPE_OPTIONS = ["all", "send", "receive", "buy", "sell", "swap", "mint"] as const;

const searchSchema = z.object({
  cursor: z.string().optional().catch(undefined),
  type: z.enum(TYPE_OPTIONS).optional().catch("all"),
  asset: z.string().optional().catch(""),
  address: z.string().optional().catch(""),
});

export const Route = createFileRoute("/pro/")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "OpenPay Pro Ledger — OpenLedger" },
      {
        name: "description",
        content:
          "Append-only public ledger of every OpenPay Pro transaction — live entries, stats, and API integration.",
      },
    ],
  }),
  component: ProLedgerPage,
});

const PAGE_SIZE = 50;
const PUBLIC_BASE = proLedgerPublicBase(OPENPAY_PRO_LEDGER_BASE_DEFAULT);

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const body = (await res.json()) as T & { error?: string };
  if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
  return body;
}

function ProLedgerPage() {
  const { cursor, type = "all", asset = "", address = "" } = Route.useSearch();
  const navigate = Route.useNavigate();
  const [assetDraft, setAssetDraft] = useState(asset);
  const [addressDraft, setAddressDraft] = useState(address);

  const stats = useQuery({
    queryKey: ["pro-ledger-stats"],
    queryFn: () => getJson<ProLedgerStats>("/api/public/pro/stats"),
    refetchInterval: 30_000,
    retry: 1,
  });

  const entries = useQuery({
    queryKey: ["pro-ledger-entries", cursor ?? "", type, asset, address],
    queryFn: () => {
      const q = new URLSearchParams({ limit: String(PAGE_SIZE) });
      if (cursor) q.set("cursor", cursor);
      if (type && type !== "all") q.set("type", type);
      if (asset.trim()) q.set("asset", asset.trim().toUpperCase());
      if (address.trim()) q.set("address", address.trim());
      return getJson<ProLedgerEntriesResponse>(`/api/public/pro/entries?${q}`);
    },
    refetchInterval: 20_000,
    retry: 1,
  });

  const rows = entries.data?.data ?? [];
  const nextCursor = entries.data?.next_cursor ?? null;
  const feed = entries.data?.feed ?? stats.data?.feed;
  const loadError = (stats.error ?? entries.error) as Error | null;

  const applyFilters = () => {
    navigate({
      to: "/pro",
      search: {
        cursor: undefined,
        type,
        asset: assetDraft.trim(),
        address: addressDraft.trim(),
      },
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex items-start gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <Layers className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs uppercase tracking-wider text-muted-foreground">Public Ledger</span>
              <span className="rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                OpenPay Pro
              </span>
              <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                Append-only
              </span>
              {feed === "live" ? (
                <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                  Live API
                </span>
              ) : feed === "mirrored" ? (
                <span className="rounded-md bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-400">
                  Local mirror
                </span>
              ) : null}
            </div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight">OpenPay Pro Ledger</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Append-only record of every OpenPay Pro transaction — mirrored from{" "}
              <code className="text-xs">ledger_entries</code> and available via API for OpenLedger sync.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
              <a
                href={OPENPAY_PRO_APP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                OpenPay Pro <ExternalLink className="h-3 w-3" />
              </a>
              <a
                href={`${PUBLIC_BASE}/stats`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                Upstream API <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        </div>
      </div>

      {loadError ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-800 dark:text-amber-200">
          <p className="font-medium">Could not load OpenPay Pro ledger</p>
          <p className="mt-1 text-amber-700/90 dark:text-amber-200/80">{loadError.message}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            For live upstream data set <code className="text-[11px]">OPENPAY_PRO_LEDGER_API_KEY</code>. Otherwise sync
            the <code className="text-[11px]">openpay_pro</code> integration in Admin to fill the local mirror.
          </p>
        </div>
      ) : null}

      {!loadError && feed === "mirrored" ? (
        <div className="rounded-xl border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
          Showing OpenLedger’s mirrored <code className="text-[11px]">openpay_pro</code> rows. Add{" "}
          <code className="text-[11px]">OPENPAY_PRO_LEDGER_API_KEY</code> in Lovable Cloud secrets for the live Pro
          public ledger API.
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          label="Total entries"
          value={stats.data ? formatInt(stats.data.total_entries) : "—"}
          sub="Immutable rows"
          loading={stats.isLoading}
        />
        <StatCard
          label="Latest sequence"
          value={stats.data ? `#${formatInt(stats.data.latest_sequence)}` : "—"}
          sub="Monotonic order"
          loading={stats.isLoading}
        />
        <StatCard
          label="Latest event"
          value={stats.data?.latest_at ? timeAgo(stats.data.latest_at) : "—"}
          sub={stats.data?.latest_at ? fullDate(stats.data.latest_at) : "—"}
          loading={stats.isLoading}
        />
        <StatCard
          label="This page"
          value={formatInt(rows.length)}
          sub={nextCursor ? `Next cursor ${nextCursor}` : "End of feed"}
          loading={entries.isLoading}
        />
      </div>

      <section className="space-y-3 rounded-xl border border-border bg-card/40 p-4">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">API Endpoints</h2>
        </div>
        <p className="text-xs text-muted-foreground">
          Auth: send header <code className="text-[11px]">x-api-key: YOUR_KEY</code>. Proxied here so the key stays
          server-side.
        </p>
        <ul className="space-y-2 font-mono text-[11px] sm:text-xs">
          {[
            ["GET", `${PUBLIC_BASE}/entries`],
            ["GET", `${PUBLIC_BASE}/entries/{id_or_sequence}`],
            ["GET", `${PUBLIC_BASE}/stats`],
          ].map(([method, url]) => (
            <li key={url} className="flex flex-wrap items-center gap-2 break-all">
              <span className="rounded bg-primary/10 px-1.5 py-0.5 font-sans text-[10px] font-semibold text-primary">
                {method}
              </span>
              <span className="text-muted-foreground">{url}</span>
              <CopyButton value={url} />
            </li>
          ))}
        </ul>
      </section>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="flex flex-wrap gap-1.5">
          {TYPE_OPTIONS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() =>
                navigate({
                  to: "/pro",
                  search: (prev) => ({ ...prev, type: t, cursor: undefined }),
                })
              }
              className={cn(
                "rounded-md border px-2.5 py-1 text-xs font-medium capitalize transition",
                type === t
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-border bg-background text-muted-foreground hover:text-foreground",
              )}
            >
              {t}
            </button>
          ))}
        </div>
        <form
          className="flex min-w-0 flex-1 flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            applyFilters();
          }}
        >
          <input
            value={assetDraft}
            onChange={(e) => setAssetDraft(e.target.value)}
            placeholder="Asset (OUSD, PI…)"
            className="h-9 w-28 rounded-md border border-border bg-background px-2.5 text-sm outline-none focus:border-primary/50"
          />
          <input
            value={addressDraft}
            onChange={(e) => setAddressDraft(e.target.value)}
            placeholder="Address filter"
            className="h-9 min-w-48 flex-1 rounded-md border border-border bg-background px-2.5 font-mono text-sm outline-none focus:border-primary/50"
          />
          <button
            type="submit"
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            <Search className="h-3.5 w-3.5" /> Filter
          </button>
        </form>
      </div>

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold">Ledger entries</h2>
            <p className="text-xs text-muted-foreground">Newest first · cursor pagination on sequence</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={!cursor || entries.isFetching}
              onClick={() =>
                navigate({
                  to: "/pro",
                  search: (prev) => ({ ...prev, cursor: undefined }),
                })
              }
              className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium disabled:opacity-40"
            >
              <ChevronLeft className="h-3.5 w-3.5" /> Newest
            </button>
            <button
              type="button"
              disabled={!nextCursor || entries.isFetching}
              onClick={() =>
                navigate({
                  to: "/pro",
                  search: (prev) => ({ ...prev, cursor: nextCursor ?? undefined }),
                })
              }
              className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium disabled:opacity-40"
            >
              Older <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {entries.isLoading && !entries.data ? (
          <PageLoader label="Loading ledger entries…" className="min-h-[30vh]" />
        ) : null}

        {!entries.isLoading && rows.length === 0 && !loadError ? (
          <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
            0 shown — no entries match these filters
            {feed === "mirrored" ? " (local mirror). Sync openpay_pro or add the live API key." : "."}
          </div>
        ) : null}

        {rows.length > 0 ? (
          <>
            <div className="hidden overflow-hidden rounded-xl border border-border md:block">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2.5 font-medium">Seq</th>
                    <th className="px-3 py-2.5 font-medium">Type</th>
                    <th className="px-3 py-2.5 font-medium">Amount</th>
                    <th className="px-3 py-2.5 font-medium">From</th>
                    <th className="px-3 py-2.5 font-medium">To</th>
                    <th className="px-3 py-2.5 font-medium">Status</th>
                    <th className="px-3 py-2.5 font-medium">When</th>
                    <th className="sticky right-0 bg-muted/40 px-3 py-2.5 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <EntryRow key={row.id} entry={row} />
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="space-y-2 md:hidden">
              {rows.map((row) => (
                <li key={row.id}>
                  <Link
                    to="/pro/entry/$id"
                    params={{ id: row.id }}
                    className="block rounded-xl border border-border bg-card p-3 transition hover:border-primary/40"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-mono text-xs text-muted-foreground">#{row.sequence}</span>
                        <TypeBadge type={row.type} />
                        <StatusBadge status={row.status} />
                      </div>
                      <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    </div>
                    <div className="mt-2 text-base font-semibold tabular-nums">
                      {formatAmount(row.amount, row.asset || "OUSD")}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {shortAddress(row.from_address)} → {shortAddress(row.to_address)}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">{timeAgo(row.occurred_at)}</div>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </section>
    </div>
  );
}

function EntryRow({ entry }: { entry: ProLedgerEntry }) {
  const navigate = useNavigate();
  return (
    <tr
      className="cursor-pointer border-b border-border/70 last:border-0 hover:bg-muted/30"
      onClick={() => {
        void navigate({ to: "/pro/entry/$id", params: { id: entry.id } });
      }}
    >
      <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">#{entry.sequence}</td>
      <td className="px-3 py-2.5">
        <TypeBadge type={entry.type} />
      </td>
      <td className="px-3 py-2.5">
        <div className="font-medium tabular-nums">{formatAmount(entry.amount, entry.asset || "OUSD")}</div>
        {entry.usd_value != null && entry.usd_value !== "" ? (
          <div className="text-xs text-muted-foreground">{formatUsd(entry.usd_value)}</div>
        ) : null}
      </td>
      <td className="px-3 py-2.5 font-mono text-xs">{shortAddress(entry.from_address)}</td>
      <td className="px-3 py-2.5 font-mono text-xs">{shortAddress(entry.to_address)}</td>
      <td className="px-3 py-2.5">
        <StatusBadge status={entry.status} />
      </td>
      <td className="px-3 py-2.5 text-xs text-muted-foreground" title={fullDate(entry.occurred_at)}>
        {timeAgo(entry.occurred_at)}
      </td>
      <td className="sticky right-0 bg-background/95 px-3 py-2.5 text-right backdrop-blur">
        <Link
          to="/pro/entry/$id"
          params={{ id: entry.id }}
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          View <ArrowRight className="h-3 w-3" />
        </Link>
      </td>
    </tr>
  );
}
