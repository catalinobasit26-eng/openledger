import { Link } from "@tanstack/react-router";
import { Activity, ArrowUpRight, Boxes, CircleCheck, Database, Radio, WalletCards } from "lucide-react";

import { SearchBar } from "@/components/search-bar";
import { Button } from "@/components/ui/button";
import { formatAmount, formatInt, formatUsd, shortAddress, shortHash, timeAgo } from "@/lib/format";

type LedgerRow = {
  hash: string;
  ts: string;
  source: string;
  type: string;
  from_address: string | null;
  to_address: string | null;
  amount: number;
  currency: string;
  status: string;
  block_number: number;
};

type DenseExplorerModeProps = {
  stats?: {
    totalTx: number;
    totalVolume: number;
    totalWallets: number;
  };
  rows: LedgerRow[];
  loading: boolean;
};

export function DenseExplorerMode({ stats, rows, loading }: DenseExplorerModeProps) {
  const latestBlock = rows[0]?.block_number ?? 0;
  const sources = new Set(rows.map((row) => row.source)).size;
  const confirmed = rows.filter((row) => row.status === "confirmed").length;
  const health = rows.length ? (confirmed / rows.length) * 100 : 100;

  const metrics = [
    { label: "Ledger transactions", value: formatInt(stats?.totalTx), note: "Verified records", icon: Activity },
    { label: "Total volume", value: formatUsd(stats?.totalVolume), note: "All currencies normalized", icon: Database },
    { label: "Tracked wallets", value: formatInt(stats?.totalWallets), note: "Unique participants", icon: WalletCards },
    { label: "Latest block", value: latestBlock ? `#${formatInt(latestBlock)}` : "—", note: `${sources} live source${sources === 1 ? "" : "s"}`, icon: Boxes },
  ];

  return (
    <section className="overflow-hidden rounded-lg border border-border bg-card shadow-[var(--shadow-panel)]">
      <div className="border-b border-border bg-secondary/45 px-4 py-5 sm:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-sm">
                <Radio className="h-4 w-4" />
              </span>
              <div>
                <h1 className="font-display text-xl font-bold text-foreground">OpenLedger Explorer</h1>
                <p className="text-xs text-muted-foreground">Live public transaction registry</p>
              </div>
            </div>
          </div>
          <div className="w-full lg:max-w-xl">
            <SearchBar />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 divide-x divide-y divide-border border-b border-border lg:grid-cols-4 lg:divide-y-0">
        {metrics.map(({ label, value, note, icon: Icon }) => (
          <div key={label} className="min-w-0 bg-card p-4 sm:p-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="truncate text-[10px] font-semibold uppercase text-muted-foreground">{label}</p>
              <Icon className="h-3.5 w-3.5 shrink-0 text-primary" />
            </div>
            <div className="truncate font-mono text-base font-semibold text-foreground sm:text-lg">
              {loading ? <span className="inline-block h-5 w-24 animate-pulse rounded bg-muted" /> : value}
            </div>
            <p className="mt-1 truncate text-[10px] text-muted-foreground">{note}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3 border-b border-border bg-muted/30 px-4 py-3 sm:px-6">
        <div>
          <h2 className="text-xs font-bold uppercase text-foreground">Latest operations</h2>
          <p className="mt-0.5 text-[10px] text-muted-foreground">Newest verified activity across OpenPay and OpenPay Pro</p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/explorer">View all <ArrowUpRight /></Link>
        </Button>
      </div>

      <div className="table-scroll">
        <table className="w-full min-w-[900px] border-collapse text-left">
          <thead className="bg-muted/35">
            <tr className="border-b border-border text-[10px] font-semibold uppercase text-muted-foreground">
              <th className="px-4 py-2.5 sm:px-6">Block</th>
              <th className="px-4 py-2.5">Transaction hash</th>
              <th className="px-4 py-2.5">Operation</th>
              <th className="px-4 py-2.5">From → To</th>
              <th className="px-4 py-2.5 text-right">Value</th>
              <th className="px-4 py-2.5">Status</th>
              <th className="px-4 py-2.5 text-right sm:px-6">Time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading ? (
              Array.from({ length: 8 }).map((_, index) => (
                <tr key={index}>
                  <td colSpan={7} className="px-6 py-3"><div className="h-4 animate-pulse rounded bg-muted" /></td>
                </tr>
              ))
            ) : rows.length ? (
              rows.map((row) => (
                <tr key={row.hash} className="group transition-colors hover:bg-primary/5">
                  <td className="px-4 py-3 font-mono text-xs font-semibold text-primary sm:px-6">#{formatInt(row.block_number)}</td>
                  <td className="px-4 py-3">
                    <Link to="/tx/$hash" params={{ hash: row.hash }} className="font-mono text-xs text-primary hover:underline">
                      {shortHash(row.hash, 8, 6)}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-xs font-semibold capitalize text-foreground">{row.type.replaceAll("_", " ")}</div>
                    <div className="mt-0.5 text-[10px] capitalize text-muted-foreground">{row.source.replaceAll("_", " ")}</div>
                  </td>
                  <td className="max-w-52 px-4 py-3 font-mono text-[11px] text-muted-foreground">
                    <span className="text-foreground">{shortAddress(row.from_address)}</span>
                    <span className="mx-1.5 text-primary">→</span>
                    <span className="text-foreground">{shortAddress(row.to_address)}</span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs font-semibold text-foreground">{formatAmount(row.amount, row.currency)}</td>
                  <td className="px-4 py-3">
                    <span className={row.status === "confirmed" ? "inline-flex items-center gap-1 text-[10px] font-semibold text-success" : "inline-flex items-center gap-1 text-[10px] font-semibold text-warning"}>
                      <CircleCheck className="h-3 w-3" /> {row.status}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-[10px] text-muted-foreground sm:px-6">{timeAgo(row.ts)}</td>
                </tr>
              ))
            ) : (
              <tr><td colSpan={7} className="px-6 py-12 text-center text-sm text-muted-foreground">No ledger activity is available.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-muted/25 px-4 py-3 font-mono text-[10px] text-muted-foreground sm:px-6">
        <span className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-success" /> Network health {health.toFixed(1)}%</span>
        <span>SHA-256 chained · {formatInt(stats?.totalTx)} permanent records</span>
      </div>
    </section>
  );
}