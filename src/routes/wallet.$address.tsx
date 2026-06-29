import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { CopyButton } from "@/components/copy-button";
import { StatCard } from "@/components/stat-card";
import { TxTable } from "@/components/tx-table";
import { formatInt, fullDate, timeAgo } from "@/lib/format";

export const Route = createFileRoute("/wallet/$address")({
  head: ({ params }) => ({
    meta: [
      { title: `Wallet ${params.address.slice(0, 8)}… — OpenLedger` },
      { name: "description", content: "Wallet activity, holdings, and transaction history on the OpenPay ledger." },
    ],
  }),
  component: WalletPage,
});

function WalletPage() {
  const { address } = Route.useParams();

  const wallet = useQuery({
    queryKey: ["wallet", address],
    queryFn: async () => {
      const { data } = await supabase.from("wallets").select("*").eq("address", address).maybeSingle();
      return data;
    },
  });

  const incoming = useQuery({
    queryKey: ["wallet-in", address],
    queryFn: async () => {
      const { data } = await supabase
        .from("ledger_transactions")
        .select("hash,ts,source,type,from_address,to_address,amount,currency,status,block_number")
        .eq("to_address", address)
        .order("ts", { ascending: false })
        .limit(100);
      return data ?? [];
    },
  });

  const outgoing = useQuery({
    queryKey: ["wallet-out", address],
    queryFn: async () => {
      const { data } = await supabase
        .from("ledger_transactions")
        .select("hash,ts,source,type,from_address,to_address,amount,currency,status,block_number")
        .eq("from_address", address)
        .order("ts", { ascending: false })
        .limit(100);
      return data ?? [];
    },
  });

  const totalIn = (incoming.data ?? []).reduce((a, r: any) => a + Number(r.amount), 0);
  const totalOut = (outgoing.data ?? []).reduce((a, r: any) => a + Number(r.amount), 0);

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs uppercase tracking-wider text-muted-foreground">Wallet</div>
        <div className="mt-1 flex items-center gap-2">
          <h1 className="break-all font-mono text-lg sm:text-xl">{address}</h1>
          <CopyButton value={address} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Transactions" value={formatInt(wallet.data?.tx_count ?? (incoming.data?.length ?? 0) + (outgoing.data?.length ?? 0))} />
        <StatCard label="Incoming" value={formatInt(incoming.data?.length)} sub={`Σ ${totalIn.toFixed(2)}`} />
        <StatCard label="Outgoing" value={formatInt(outgoing.data?.length)} sub={`Σ ${totalOut.toFixed(2)}`} />
        <StatCard label="First seen" value={wallet.data ? timeAgo(wallet.data.first_seen) : "—"} sub={wallet.data ? fullDate(wallet.data.first_seen) : ""} />
      </div>

      <section>
        <h2 className="mb-3 text-sm font-semibold">Incoming transactions</h2>
        <TxTable rows={(incoming.data ?? []) as any} dense />
      </section>
      <section>
        <h2 className="mb-3 text-sm font-semibold">Outgoing transactions</h2>
        <TxTable rows={(outgoing.data ?? []) as any} dense />
      </section>
    </div>
  );
}
