import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { SearchBar } from "@/components/search-bar";
import { TxTable } from "@/components/tx-table";
import { useLedgerRealtime } from "@/hooks/use-ledger-realtime";

const PAGE_SIZE = 50;

const searchSchema = z.object({
  q: z.string().optional().catch(""),
  page: z.coerce.number().int().min(1).optional().catch(1),
});

export const Route = createFileRoute("/explorer")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Explorer — OpenLedger" },
      { name: "description", content: "Browse the full OpenPay transaction history — search by hash, wallet, merchant, token or NFT." },
    ],
  }),
  component: ExplorerPage,
});

function ExplorerPage() {
  useLedgerRealtime();
  const { q, page } = Route.useSearch();
  const navigate = useNavigate();
  const query = (q ?? "").trim();
  const currentPage = Math.max(1, Number(page ?? 1));
  const offset = (currentPage - 1) * PAGE_SIZE;

  const total = useQuery({
    queryKey: ["ledger-total"],
    queryFn: async () => {
      const { count } = await supabase
        .from("ledger_transactions")
        .select("hash", { count: "exact", head: true });
      return count ?? 0;
    },
    refetchInterval: 15_000,
  });

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

  const history = useQuery({
    enabled: query.length === 0,
    queryKey: ["history-tx", currentPage],
    queryFn: async () => {
      const { data } = await supabase
        .from("ledger_transactions")
        .select("hash,ts,source,type,from_address,to_address,amount,currency,status,block_number")
        .order("ts", { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);
      return data ?? [];
    },
    refetchInterval: 10000,
  });

  const totalCount = total.data ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const goPage = (p: number) => navigate({ to: "/explorer", search: (prev: any) => ({ ...prev, page: p }) });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Explorer</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Full ledger history — search by transaction hash, wallet, merchant, token or NFT.
        </p>
      </div>
      <SearchBar size="lg" />

      {query ? (
        <div className="space-y-6">
          {(walletResults.data?.length ?? 0) > 0 && (
            <ResultGroup title="Wallets">
              {walletResults.data!.map((w: any) => (
                <Link key={w.address} to="/wallet/$address" params={{ address: w.address }} className="block rounded-lg border border-border bg-card p-3 hover:border-primary/40">
                  <div className="font-mono text-xs text-primary break-all">{w.address}</div>
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
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">
              Ledger history <span className="ml-2 text-xs font-normal text-muted-foreground">{totalCount.toLocaleString()} records</span>
            </h2>
            <div className="text-xs text-muted-foreground">
              Page {currentPage} of {totalPages.toLocaleString()}
            </div>
          </div>
          <TxTable rows={(history.data ?? []) as any} dense />
          <div className="mt-4 flex items-center justify-between gap-2">
            <button
              onClick={() => goPage(Math.max(1, currentPage - 1))}
              disabled={currentPage <= 1}
              className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium disabled:opacity-40 hover:border-primary/40"
            >
              <ChevronLeft className="h-3.5 w-3.5" /> Previous
            </button>
            <div className="flex items-center gap-1 text-xs">
              <button onClick={() => goPage(1)} className="rounded-md px-2 py-1 hover:bg-muted disabled:opacity-40" disabled={currentPage === 1}>First</button>
              <button onClick={() => goPage(totalPages)} className="rounded-md px-2 py-1 hover:bg-muted disabled:opacity-40" disabled={currentPage >= totalPages}>Last</button>
            </div>
            <button
              onClick={() => goPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage >= totalPages}
              className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium disabled:opacity-40 hover:border-primary/40"
            >
              Next <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
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

