import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Radio } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { TypeBadge, StatusBadge } from "@/components/badges";
import { formatNumber, shortHash, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

type TickerRow = {
  hash: string;
  ts: string;
  type: string;
  status: string;
  source: string;
  amount: number | string;
  currency: string;
  from_address: string | null;
  to_address: string | null;
};

/** Always-on stream of the newest ledger writes. */
export function LiveTicker({ limit = 12, className }: { limit?: number; className?: string }) {
  const feed = useQuery({
    queryKey: ["live-ticker", limit],
    queryFn: async () => {
      const { data } = await supabase
        .from("ledger_transactions")
        .select("hash,ts,type,status,source,amount,currency,from_address,to_address")
        .order("ts", { ascending: false })
        .limit(limit);
      return (data ?? []) as TickerRow[];
    },
    refetchInterval: 5000,
  });

  const rows = feed.data ?? [];

  return (
    <div className={cn("panel panel-hover flex h-full flex-col overflow-hidden", className)}>
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="relative flex h-2 w-2 shrink-0 text-success">
            <span className="live-dot absolute inset-0 rounded-full" />
            <span className="absolute inset-0 rounded-full bg-success" />
          </span>
          <h2 className="truncate text-sm font-semibold">Live stream</h2>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
          <Radio className="h-3 w-3" /> 5s
        </span>
      </div>

      <ul className="min-h-0 flex-1 divide-y divide-border overflow-y-auto">
        {feed.isLoading
          ? Array.from({ length: 6 }).map((_, i) => (
              <li key={i} className="px-4 py-2.5">
                <Skeleton className="h-4 w-full" />
              </li>
            ))
          : rows.map((r) => (
              <li key={r.hash} className="animate-row-in">
                <Link
                  to="/tx/$hash"
                  params={{ hash: r.hash }}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-2.5 transition hover:bg-muted/50"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <TypeBadge type={r.type} />
                      <span className="truncate font-mono text-[11px] text-primary">
                        {shortHash(r.hash, 8, 6)}
                      </span>
                    </div>
                    <div className="mt-1 truncate font-mono text-[10px] text-muted-foreground">
                      {shortHash(r.from_address, 6, 4)} → {shortHash(r.to_address, 6, 4)}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="font-mono text-xs font-semibold tabular-nums">
                      {formatNumber(r.amount)} <span className="text-muted-foreground">{r.currency}</span>
                    </div>
                    <div className="mt-1 flex items-center justify-end gap-1.5">
                      <StatusBadge status={r.status} />
                      <span className="text-[10px] text-muted-foreground">{timeAgo(r.ts)}</span>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
        {!feed.isLoading && rows.length === 0 ? (
          <li className="px-4 py-8 text-center text-xs text-muted-foreground">No transactions yet.</li>
        ) : null}
      </ul>
    </div>
  );
}
