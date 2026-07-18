import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";

import { supabase } from "@/integrations/supabase/client";
import { SearchBar } from "@/components/search-bar";
import { TxTable } from "@/components/tx-table";
import { shortAddress } from "@/lib/format";
import { useLedgerRealtime } from "@/hooks/use-ledger-realtime";


const searchSchema = z.object({ q: z.string().optional().catch("") });

export const Route = createFileRoute("/explorer")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Explorer — OpenLedger" },
      { name: "description", content: "Search OpenPay transactions, wallets, merchants, tokens and NFTs across the OpenPay public ledger." },
    ],
  }),
  component: ExplorerPage,
});

function ExplorerPage() {
  useLedgerRealtime();
  const { q } = Route.useSearch();
  const query = (q ?? "").trim();



  // Routing logic — if q looks like a hash/address/known id, navigate via results.
  const txResults = useQuery({
    enabled: query.length > 0,
    queryKey: ["search-tx", query],
    queryFn: async () => {
      const { data } = await supabase
        .from("ledger_transactions")
        .select("hash,ts,source,type,from_address,to_address,amount,currency,status,block_number")
        .or(`hash.ilike.${query}%,from_address.ilike.${query}%,to_address.ilike.${query}%,merchant_id.ilike.${query}%`)
        .order("ts", { ascending: false })
        .limit(50);
      return data ?? [];
    },
  });

  const walletResults = useQuery({
    enabled: query.length > 0,
    queryKey: ["search-wallet", query],
    queryFn: async () => {
      const { data } = await supabase.from("wallets").select("*").ilike("address", `${query}%`).limit(10);
      return data ?? [];
    },
  });

  const merchantResults = useQuery({
    enabled: query.length > 0,
    queryKey: ["search-merchant", query],
    queryFn: async () => {
      const { data } = await supabase
        .from("merchants")
        .select("*")
        .or(`id.ilike.%${query}%,name.ilike.%${query}%`)
        .limit(10);
      return data ?? [];
    },
  });

  const tokenResults = useQuery({
    enabled: query.length > 0,
    queryKey: ["search-token", query],
    queryFn: async () => {
      const { data } = await supabase
        .from("tokens")
        .select("*")
        .or(`symbol.ilike.%${query}%,name.ilike.%${query}%`)
        .limit(10);
      return data ?? [];
    },
  });

  const latest = useQuery({
    enabled: query.length === 0,
    queryKey: ["latest-tx-explorer"],
    queryFn: async () => {
      const { data } = await supabase
        .from("ledger_transactions")
        .select("hash,ts,source,type,from_address,to_address,amount,currency,status,block_number")
        .order("ts", { ascending: false })
        .limit(50);
      return data ?? [];
    },
    refetchInterval: 10000,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Explorer</h1>
        <p className="mt-1 text-sm text-muted-foreground">Search by transaction hash, wallet address, merchant, token symbol, or NFT.</p>
      </div>
      <SearchBar size="lg" />

      {query ? (
        <div className="space-y-6">
          {(walletResults.data?.length ?? 0) > 0 && (
            <ResultGroup title="Wallets">
              {walletResults.data!.map((w: any) => (
                <Link key={w.address} to="/wallet/$address" params={{ address: w.address }} className="block rounded-lg border border-border bg-card p-3 hover:border-primary/40">
                  <div className="font-mono text-xs text-primary">{w.address}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{w.tx_count} transactions</div>
                </Link>
              ))}
            </ResultGroup>
          )}
          {(merchantResults.data?.length ?? 0) > 0 && (
            <ResultGroup title="Merchants">
              {merchantResults.data!.map((m: any) => (
                <Link key={m.id} to="/merchants/$id" params={{ id: m.id }} className="block rounded-lg border border-border bg-card p-3 hover:border-primary/40">
                  <div className="font-medium">{m.name}</div>
                  <div className="text-xs text-muted-foreground">{m.id} · {m.category}</div>
                </Link>
              ))}
            </ResultGroup>
          )}
          {(tokenResults.data?.length ?? 0) > 0 && (
            <ResultGroup title="Tokens">
              {tokenResults.data!.map((t: any) => (
                <Link key={t.symbol} to="/tokens/$symbol" params={{ symbol: t.symbol }} className="block rounded-lg border border-border bg-card p-3 hover:border-primary/40">
                  <div className="font-medium">{t.symbol} <span className="ml-2 text-xs text-muted-foreground">{t.name}</span></div>
                </Link>
              ))}
            </ResultGroup>
          )}
          <section>
            <h2 className="mb-3 text-sm font-semibold">Transactions matching “{query}”</h2>
            <TxTable rows={(txResults.data ?? []) as any} dense />
          </section>
        </div>
      ) : (
        <section>
          <h2 className="mb-3 text-sm font-semibold">Latest 50 transactions</h2>
          <TxTable rows={(latest.data ?? []) as any} dense />
        </section>
      )}
    </div>
  );
}

function ResultGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h2>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </section>
  );
}
