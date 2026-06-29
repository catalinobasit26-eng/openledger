import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { StatCard } from "@/components/stat-card";
import { TxTable } from "@/components/tx-table";
import { Pill } from "@/components/badges";
import { formatInt, formatUsd } from "@/lib/format";

export const Route = createFileRoute("/merchants/$id")({
  head: ({ params }) => ({
    meta: [
      { title: `Merchant ${params.id} — OpenLedger` },
      { name: "description", content: "Merchant activity and transaction history on the OpenPay public ledger." },
    ],
  }),
  component: MerchantDetail,
});

function MerchantDetail() {
  const { id } = Route.useParams();
  const merchant = useQuery({
    queryKey: ["merchant", id],
    queryFn: async () => {
      const { data } = await supabase.from("merchants").select("*").eq("id", id).maybeSingle();
      return data;
    },
  });
  const tx = useQuery({
    queryKey: ["merchant-tx", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("ledger_transactions")
        .select("hash,ts,source,type,from_address,to_address,amount,currency,status,block_number")
        .eq("merchant_id", id)
        .order("ts", { ascending: false })
        .limit(100);
      return data ?? [];
    },
  });
  const m = merchant.data;
  if (!m) return <div className="text-sm text-muted-foreground">Merchant not found.</div>;
  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs uppercase tracking-wider text-muted-foreground">Merchant</div>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">{m.name}</h1>
          {m.verified && <Pill tone="primary">Verified</Pill>}
          <span className="text-xs text-muted-foreground font-mono">{m.id}</span>
        </div>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{m.description}</p>
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total Sales" value={formatInt(m.total_sales)} />
        <StatCard label="Volume" value={formatUsd(m.total_volume)} />
        <StatCard label="Transactions" value={formatInt(m.tx_count)} />
        <StatCard label="Category" value={<span className="text-base">{m.category}</span>} />
      </div>
      <section>
        <h2 className="mb-3 text-sm font-semibold">Recent transactions</h2>
        <TxTable rows={(tx.data ?? []) as any} dense />
      </section>
    </div>
  );
}
