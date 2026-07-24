import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import type { CSSProperties, KeyboardEvent, MouseEvent } from "react";
import { shortAddress, shortHash, formatAmount, timeAgo } from "@/lib/format";
import { StatusBadge, SourceBadge, TypeBadge } from "./badges";
import { Skeleton } from "@/components/ui/skeleton";

export interface TxRow {
  hash: string;
  ts: string;
  source: string;
  type: string;
  from_address: string | null;
  to_address: string | null;
  amount: number | string;
  currency: string;
  status: string;
  block_number: number;
}

function TableSkeleton({ dense, rows = 6 }: { dense?: boolean; rows?: number }) {
  const cols = dense ? 10 : 11;
  return (
    <div className="rounded-xl border border-border bg-card animate-fade-up">
      <div className="table-scroll">
        <table className="w-full min-w-5xl text-sm">
          <thead className="bg-muted/50 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Tx Hash</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">From</th>
              <th className="px-4 py-3 font-medium" />
              <th className="px-4 py-3 font-medium">To</th>
              <th className="px-4 py-3 font-medium text-right">Amount</th>
              <th className="px-4 py-3 font-medium">Source</th>
              <th className="px-4 py-3 font-medium">Status</th>
              {!dense && <th className="px-4 py-3 font-medium">Block</th>}
              <th className="px-4 py-3 font-medium">Age</th>
              <th className="px-3 py-3 font-medium text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }).map((_, i) => (
              <tr key={i} className="border-t border-border">
                {Array.from({ length: cols }).map((__, j) => (
                  <td key={j} className="px-4 py-3">
                    <Skeleton className="h-4 w-full max-w-28" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function stopRowNav(e: MouseEvent) {
  e.stopPropagation();
}

function TxMobileCards({ rows }: { rows: TxRow[] }) {
  return (
    <ul className="divide-y divide-border sm:hidden">
      {rows.map((r) => (
        <li key={r.hash}>
          <Link
            to="/tx/$hash"
            params={{ hash: r.hash }}
            className="block space-y-2 px-4 py-3 transition hover:bg-muted/40"
          >
            <div className="flex items-start justify-between gap-3">
              <span className="font-mono text-xs text-primary break-all">{shortHash(r.hash, 10, 8)}</span>
              <span className="shrink-0 text-xs text-muted-foreground whitespace-nowrap">{timeAgo(r.ts)}</span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <TypeBadge type={r.type} />
              <SourceBadge source={r.source} />
              <StatusBadge status={r.status} />
            </div>
            <div className="flex items-center gap-2 text-xs min-w-0">
              <span className="font-mono text-muted-foreground truncate">
                {r.from_address ? shortAddress(r.from_address) : "—"}
              </span>
              <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="font-mono text-muted-foreground truncate">
                {r.to_address ? shortAddress(r.to_address) : "—"}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="font-medium tabular-nums">{formatAmount(r.amount, r.currency)}</span>
              <span className="shrink-0 rounded-md bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary">
                View →
              </span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function TxTable({
  rows,
  dense = false,
  loading = false,
}: {
  rows: TxRow[];
  dense?: boolean;
  loading?: boolean;
}) {
  const navigate = useNavigate();

  if (loading) return <TableSkeleton dense={dense} />;

  if (!rows.length) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground animate-fade-up">
        No transactions found.
      </div>
    );
  }

  const openTx = (hash: string) => {
    void navigate({ to: "/tx/$hash", params: { hash } });
  };

  const onRowKey = (e: KeyboardEvent, hash: string) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openTx(hash);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card animate-fade-up">
      <TxMobileCards rows={rows} />
      <div className="hidden table-scroll sm:block">
        <table className="w-full min-w-5xl text-sm">
          <thead className="bg-muted/50 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Tx Hash</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">From</th>
              <th className="px-4 py-3 font-medium" />
              <th className="px-4 py-3 font-medium">To</th>
              <th className="px-4 py-3 font-medium text-right">Amount</th>
              <th className="px-4 py-3 font-medium">Source</th>
              <th className="px-4 py-3 font-medium">Status</th>
              {!dense && <th className="px-4 py-3 font-medium">Block</th>}
              <th className="px-4 py-3 font-medium">Age</th>
              <th className="sticky right-0 z-10 bg-muted/95 px-3 py-3 font-medium text-right shadow-[-8px_0_12px_-8px_rgba(0,0,0,0.15)] backdrop-blur-sm">
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr
                key={r.hash}
                role="link"
                tabIndex={0}
                onClick={() => openTx(r.hash)}
                onKeyDown={(e) => onRowKey(e, r.hash)}
                className="border-t border-border transition-colors duration-200 hover:bg-muted/30 animate-fade-up cursor-pointer group"
                style={{ "--fade-delay": `${80 + i * 35}ms` } as CSSProperties}
              >
                <td className="px-4 py-3">
                  <Link
                    to="/tx/$hash"
                    params={{ hash: r.hash }}
                    onClick={stopRowNav}
                    className="font-mono text-xs text-primary hover:underline"
                  >
                    {shortHash(r.hash, 8, 6)}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <TypeBadge type={r.type} />
                </td>
                <td className="px-4 py-3">
                  {r.from_address ? (
                    <Link
                      to="/wallet/$address"
                      params={{ address: r.from_address }}
                      onClick={stopRowNav}
                      className="font-mono text-xs text-muted-foreground hover:text-primary transition-colors"
                    >
                      {shortAddress(r.from_address)}
                    </Link>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-2 py-3 text-muted-foreground">
                  <ArrowRight className="h-3.5 w-3.5" />
                </td>
                <td className="px-4 py-3">
                  {r.to_address ? (
                    <Link
                      to="/wallet/$address"
                      params={{ address: r.to_address }}
                      onClick={stopRowNav}
                      className="font-mono text-xs text-muted-foreground hover:text-primary transition-colors"
                    >
                      {shortAddress(r.to_address)}
                    </Link>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-4 py-3 text-right font-medium tabular-nums whitespace-nowrap">
                  {formatAmount(r.amount, r.currency)}
                </td>
                <td className="px-4 py-3">
                  <SourceBadge source={r.source} />
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={r.status} />
                </td>
                {!dense && (
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">#{r.block_number}</td>
                )}
                <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{timeAgo(r.ts)}</td>
                <td className="sticky right-0 z-10 bg-card px-3 py-3 text-right shadow-[-8px_0_12px_-8px_rgba(0,0,0,0.12)] group-hover:bg-muted/80">
                  <Link
                    to="/tx/$hash"
                    params={{ hash: r.hash }}
                    onClick={stopRowNav}
                    className="inline-flex items-center rounded-md bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary whitespace-nowrap hover:bg-primary/15"
                  >
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
