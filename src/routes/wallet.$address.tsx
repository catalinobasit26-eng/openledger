import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { CopyButton } from "@/components/copy-button";
import { StatCard } from "@/components/stat-card";
import { TxTable } from "@/components/tx-table";
import { WatchButton } from "@/components/watch-button";
import { ExportButton } from "@/components/export-button";
import { formatInt, formatNumber, fullDate, timeAgo } from "@/lib/format";

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

  const inRows = incoming.data ?? [];
  const outRows = outgoing.data ?? [];
  const allRows = [...inRows, ...outRows].sort((a: any, b: any) => (a.ts < b.ts ? 1 : -1));
  const totalIn = inRows.reduce((a, r: any) => a + Number(r.amount), 0);
  const totalOut = outRows.reduce((a, r: any) => a + Number(r.amount), 0);

  // Per-currency portfolio: net flow across the last 100 in/out transactions.
  const portfolio = Object.values(
    allRows.reduce((acc: Record<string, { currency: string; in: number; out: number; tx: number }>, r: any) => {
      const cur = r.currency || "OUSD";
      acc[cur] ??= { currency: cur, in: 0, out: 0, tx: 0 };
      if (r.to_address === address) acc[cur].in += Number(r.amount);
      else acc[cur].out += Number(r.amount);
      acc[cur].tx += 1;
      return acc;
    }, {}),
  ).sort((a, b) => b.in + b.out - (a.in + a.out));

  // Top counterparties by transaction count.
  const counterparties = Object.values(
    allRows.reduce((acc: Record<string, { peer: string; tx: number; volume: number }>, r: any) => {
      const peer = (r.to_address === address ? r.from_address : r.to_address) ?? "unknown";
      acc[peer] ??= { peer, tx: 0, volume: 0 };
      acc[peer].tx += 1;
      acc[peer].volume += Number(r.amount);
      return acc;
    }, {}),
  )
    .sort((a, b) => b.tx - a.tx)
    .slice(0, 8);

  return (
    <div className="space-y-6">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 sm:flex sm:flex-wrap sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Wallet</div>
          <div className="mt-1 flex items-center gap-2">
            <h1 className="break-all font-mono text-base sm:text-xl">{address}</h1>
            <CopyButton value={address} />
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <WatchButton kind="wallet" id={address} label={address} />
          <ExportButton rows={allRows as any} filename={`wallet-${address.slice(0, 10)}`} />
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Transactions" value={formatInt(wallet.data?.tx_count ?? inRows.length + outRows.length)} />
        <StatCard label="Incoming" value={formatInt(inRows.length)} sub={`Σ ${totalIn.toFixed(2)}`} />
        <StatCard label="Outgoing" value={formatInt(outRows.length)} sub={`Σ ${totalOut.toFixed(2)}`} />
        <StatCard label="First seen" value={wallet.data ? timeAgo(wallet.data.first_seen) : "—"} sub={wallet.data ? fullDate(wallet.data.first_seen) : ""} />
      </div>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="panel panel-hover p-5">
          <h2 className="mb-3 text-sm font-semibold">Portfolio by currency</h2>
          {portfolio.length === 0 ? (
            <p className="text-xs text-muted-foreground">No activity recorded yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {portfolio.map((p) => {
                const net = p.in - p.out;
                return (
                  <li key={p.currency} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-2.5">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{p.currency}</div>
                      <div className="text-[11px] text-muted-foreground">{formatInt(p.tx)} transactions</div>
                    </div>
                    <div className="shrink-0 text-right font-mono text-xs tabular-nums">
                      <div className={net >= 0 ? "text-success" : "text-destructive"}>
                        {net >= 0 ? "+" : ""}
                        {formatNumber(net)}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        in {formatNumber(p.in)} · out {formatNumber(p.out)}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="panel panel-hover p-5">
          <h2 className="mb-3 text-sm font-semibold">Top counterparties</h2>
          {counterparties.length === 0 ? (
            <p className="text-xs text-muted-foreground">No counterparties yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {counterparties.map((c) => (
                <li key={c.peer} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-2.5">
                  <Link
                    to="/wallet/$address"
                    params={{ address: c.peer }}
                    className="min-w-0 truncate font-mono text-xs text-primary hover:underline"
                  >
                    {c.peer}
                  </Link>
                  <div className="shrink-0 text-right">
                    <div className="font-mono text-xs tabular-nums">{formatNumber(c.volume)}</div>
                    <div className="text-[10px] text-muted-foreground">{formatInt(c.tx)} tx</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section>
        <div className="mb-3 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <h2 className="truncate text-sm font-semibold">Incoming transactions</h2>
          <ExportButton rows={inRows as any} filename={`wallet-${address.slice(0, 10)}-incoming`} label="CSV" />
        </div>
        <TxTable rows={inRows as any} dense loading={incoming.isLoading} />
      </section>
      <section>
        <div className="mb-3 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <h2 className="truncate text-sm font-semibold">Outgoing transactions</h2>
          <ExportButton rows={outRows as any} filename={`wallet-${address.slice(0, 10)}-outgoing`} label="CSV" />
        </div>
        <TxTable rows={outRows as any} dense loading={outgoing.isLoading} />
      </section>
    </div>
  );
}

