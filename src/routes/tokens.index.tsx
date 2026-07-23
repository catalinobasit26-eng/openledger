import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { TrendingDown, TrendingUp } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { formatInt, formatUsd } from "@/lib/format";
import { useLedgerRealtime } from "@/hooks/use-ledger-realtime";

export const Route = createFileRoute("/tokens/")({
  head: () => ({
    meta: [
      { title: "Tokens — OpenLedger" },
      { name: "description", content: "OUSD, OPEN, and ecosystem tokens tracked on the OpenPay ledger." },
    ],
  }),
  component: TokensIndex,
});

function TokensIndex() {
  useLedgerRealtime();
  const { data } = useQuery({
    queryKey: ["tokens"],
    queryFn: async () => {
      const { data } = await supabase.from("tokens").select("*").order("volume_24h", { ascending: false });
      return data ?? [];
    },
    refetchInterval: 15_000,
  });
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Tokens</h1>
        <p className="mt-1 text-sm text-muted-foreground">Tokens active on the OpenPay ecosystem.</p>
      </div>
      <div className="rounded-xl border border-border bg-card">
        <ul className="divide-y divide-border sm:hidden">
          {(data ?? []).map((t: any) => (
            <li key={t.symbol}>
              <Link
                to="/tokens/$symbol"
                params={{ symbol: t.symbol }}
                className="block space-y-2 px-4 py-3 transition hover:bg-muted/40"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold text-primary">{t.symbol}</div>
                    <div className="text-xs text-muted-foreground wrap-break-word">{t.name}</div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="tabular-nums font-medium">{formatUsd(t.price_usd)}</div>
                    <div className={`text-xs tabular-nums ${Number(t.change_24h) >= 0 ? "text-success" : "text-destructive"}`}>
                      {Number(t.change_24h) >= 0 ? "+" : ""}
                      {Number(t.change_24h).toFixed(2)}%
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-[11px] text-muted-foreground">
                  <div>
                    <div>Vol 24h</div>
                    <div className="font-medium tabular-nums text-foreground">{formatUsd(t.volume_24h)}</div>
                  </div>
                  <div>
                    <div>Holders</div>
                    <div className="font-medium tabular-nums text-foreground">{formatInt(t.holders)}</div>
                  </div>
                  <div>
                    <div>Transfers</div>
                    <div className="font-medium tabular-nums text-foreground">{formatInt(t.transfers_count)}</div>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
        <div className="hidden table-scroll sm:block">
          <table className="w-full min-w-160 text-sm">
            <thead className="bg-muted/50 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Symbol</th>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium text-right">Price</th>
                <th className="px-4 py-3 font-medium text-right">24h</th>
                <th className="px-4 py-3 font-medium text-right">Volume 24h</th>
                <th className="px-4 py-3 font-medium text-right">Holders</th>
                <th className="px-4 py-3 font-medium text-right">Transfers</th>
              </tr>
            </thead>
            <tbody>
              {(data ?? []).map((t: any) => (
                <tr key={t.symbol} className="border-t border-border hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <Link to="/tokens/$symbol" params={{ symbol: t.symbol }} className="font-semibold text-primary hover:underline">
                      {t.symbol}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{t.name}</td>
                  <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap">{formatUsd(t.price_usd)}</td>
                  <td className={`px-4 py-3 text-right tabular-nums whitespace-nowrap ${Number(t.change_24h) >= 0 ? "text-success" : "text-destructive"}`}>
                    <span className="inline-flex items-center gap-1">
                      {Number(t.change_24h) >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      {Number(t.change_24h).toFixed(2)}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap">{formatUsd(t.volume_24h)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatInt(t.holders)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatInt(t.transfers_count)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
