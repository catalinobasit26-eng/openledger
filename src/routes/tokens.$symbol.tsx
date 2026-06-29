import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { StatCard } from "@/components/stat-card";
import { TxTable } from "@/components/tx-table";
import { formatInt, formatNumber, formatUsd } from "@/lib/format";

export const Route = createFileRoute("/tokens/$symbol")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.symbol} — OpenPay Ledger` },
      { name: "description", content: `${params.symbol} token activity on the OpenPay ledger.` },
    ],
  }),
  component: TokenDetail,
});

function TokenDetail() {
  const { symbol } = Route.useParams();
  const token = useQuery({
    queryKey: ["token", symbol],
    queryFn: async () => {
      const { data } = await supabase.from("tokens").select("*").eq("symbol", symbol).maybeSingle();
      return data;
    },
  });
  const tx = useQuery({
    queryKey: ["token-tx", symbol],
    queryFn: async () => {
      const { data } = await supabase
        .from("ledger_transactions")
        .select("hash,ts,source,type,from_address,to_address,amount,currency,status,block_number")
        .eq("currency", symbol)
        .order("ts", { ascending: false })
        .limit(100);
      return data ?? [];
    },
  });
  const t = token.data;
  if (!t) return <div className="text-sm text-muted-foreground">Token not found.</div>;
  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs uppercase tracking-wider text-muted-foreground">Token</div>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">{t.symbol} <span className="ml-2 text-base font-normal text-muted-foreground">{t.name}</span></h1>
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard label="Price" value={formatUsd(t.price_usd)} />
        <StatCard label="24h Change" value={`${Number(t.change_24h).toFixed(2)}%`} />
        <StatCard label="Volume 24h" value={formatUsd(t.volume_24h)} />
        <StatCard label="Holders" value={formatInt(t.holders)} />
        <StatCard label="Supply" value={formatNumber(t.supply)} />
      </div>
      <section>
        <h2 className="mb-3 text-sm font-semibold">Recent {t.symbol} transfers</h2>
        <TxTable rows={(tx.data ?? []) as any} dense />
      </section>
    </div>
  );
}
