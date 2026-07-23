import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { StatCard } from "@/components/stat-card";
import { TxTable } from "@/components/tx-table";
import { PageLoader } from "@/components/page-loader";
import { formatInt, formatNumber, formatUsd } from "@/lib/format";
import { useTokenRealtime } from "@/hooks/use-token-realtime";

export const Route = createFileRoute("/tokens/$symbol")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.symbol} — OpenLedger` },
      { name: "description", content: `${params.symbol} token activity on the OpenPay ledger.` },
    ],
  }),
  component: TokenDetail,
});

function TokenDetail() {
  const { symbol: raw } = Route.useParams();
  const symbol = String(raw ?? "").toUpperCase();
  useTokenRealtime(symbol);

  const token = useQuery({
    queryKey: ["token", symbol],
    enabled: !!symbol,
    queryFn: async () => {
      const { data, error } = await supabase.from("tokens").select("*").eq("symbol", symbol).maybeSingle();
      if (error) throw error;
      return data;
    },
    refetchInterval: 10_000,
  });

  const tx = useQuery({
    queryKey: ["token-tx", symbol],
    enabled: !!symbol,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ledger_transactions")
        .select("hash,ts,source,type,from_address,to_address,amount,currency,status,block_number")
        .eq("currency", symbol)
        .order("ts", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 8_000,
  });

  if (token.isLoading) return <PageLoader label={`Loading ${symbol}…`} />;
  const t = token.data;
  if (!t) return <div className="text-sm text-muted-foreground">Token not found.</div>;

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs uppercase tracking-wider text-muted-foreground">Token</div>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">
          {t.symbol}{" "}
          <span className="ml-2 text-base font-normal text-muted-foreground">{t.name}</span>
        </h1>
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard label="Price" value={formatUsd(t.price_usd)} loading={token.isFetching && !token.data} />
        <StatCard label="24h Change" value={`${Number(t.change_24h).toFixed(2)}%`} />
        <StatCard label="Volume 24h" value={formatUsd(t.volume_24h)} />
        <StatCard label="Holders" value={formatInt(t.holders)} />
        <StatCard label="Supply" value={formatNumber(t.supply)} />
      </div>
      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold">Recent {t.symbol} transfers</h2>
          {tx.isFetching ? (
            <span className="text-[11px] text-muted-foreground">Updating…</span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className="live-dot relative flex h-1.5 w-1.5">
                <span className="absolute inset-0 rounded-full bg-success" />
              </span>
              Live
            </span>
          )}
        </div>
        <TxTable rows={(tx.data ?? []) as any} dense loading={tx.isLoading} />
      </section>
    </div>
  );
}
