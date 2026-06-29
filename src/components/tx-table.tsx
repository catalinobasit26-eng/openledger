import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { shortAddress, shortHash, formatAmount, timeAgo } from "@/lib/format";
import { StatusBadge, SourceBadge, TypeBadge } from "./badges";

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

export function TxTable({ rows, dense = false }: { rows: TxRow[]; dense?: boolean }) {
  if (!rows.length) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
        No transactions found.
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
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
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.hash} className="border-t border-border transition hover:bg-muted/30">
                <td className="px-4 py-3">
                  <Link
                    to="/tx/$hash"
                    params={{ hash: r.hash }}
                    className="font-mono text-xs text-primary hover:underline"
                  >
                    {shortHash(r.hash, 8, 6)}
                  </Link>
                </td>
                <td className="px-4 py-3"><TypeBadge type={r.type} /></td>
                <td className="px-4 py-3">
                  {r.from_address ? (
                    <Link to="/wallet/$address" params={{ address: r.from_address }} className="font-mono text-xs text-muted-foreground hover:text-primary">
                      {shortAddress(r.from_address)}
                    </Link>
                  ) : "—"}
                </td>
                <td className="px-2 py-3 text-muted-foreground"><ArrowRight className="h-3.5 w-3.5" /></td>
                <td className="px-4 py-3">
                  {r.to_address ? (
                    <Link to="/wallet/$address" params={{ address: r.to_address }} className="font-mono text-xs text-muted-foreground hover:text-primary">
                      {shortAddress(r.to_address)}
                    </Link>
                  ) : "—"}
                </td>
                <td className="px-4 py-3 text-right font-medium tabular-nums">{formatAmount(r.amount, r.currency)}</td>
                <td className="px-4 py-3"><SourceBadge source={r.source} /></td>
                <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                {!dense && <td className="px-4 py-3 font-mono text-xs text-muted-foreground">#{r.block_number}</td>}
                <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{timeAgo(r.ts)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
