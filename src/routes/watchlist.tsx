import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Star, Trash2, Wallet, Coins, Store, Image as ImageIcon } from "lucide-react";
import type { ReactNode } from "react";

import { supabase } from "@/integrations/supabase/client";
import { TxTable } from "@/components/tx-table";
import { ExportButton } from "@/components/export-button";
import { useLedgerRealtime } from "@/hooks/use-ledger-realtime";
import { useWatchlist, type WatchKind } from "@/lib/watchlist";
import { formatInt } from "@/lib/format";

export const Route = createFileRoute("/watchlist")({
  head: () => ({
    meta: [
      { title: "Watchlist — OpenLedger" },
      {
        name: "description",
        content:
          "Track your starred OpenPay wallets, tokens, merchants and NFT collections with a combined live activity feed.",
      },
      { property: "og:title", content: "Watchlist — OpenLedger" },
      {
        property: "og:description",
        content: "Track your starred OpenPay wallets, tokens, merchants and NFT collections in one live feed.",
      },
    ],
  }),
  component: WatchlistPage,
});

const KIND_META: Record<WatchKind, { icon: ReactNode; label: string }> = {
  wallet: { icon: <Wallet className="h-3.5 w-3.5" />, label: "Wallet" },
  token: { icon: <Coins className="h-3.5 w-3.5" />, label: "Token" },
  merchant: { icon: <Store className="h-3.5 w-3.5" />, label: "Merchant" },
  collection: { icon: <ImageIcon className="h-3.5 w-3.5" />, label: "Collection" },
};

function WatchlistPage() {
  useLedgerRealtime();
  const { items, ready, remove, clear } = useWatchlist();
  const wallets = items.filter((i) => i.kind === "wallet").map((i) => i.id);

  const activity = useQuery({
    enabled: ready && wallets.length > 0,
    queryKey: ["watchlist-activity", wallets.join(",")],
    queryFn: async () => {
      const list = wallets.map((w) => `"${w}"`).join(",");
      const { data } = await supabase
        .from("ledger_transactions")
        .select("hash,ts,source,type,from_address,to_address,amount,currency,status,block_number")
        .or(`from_address.in.(${list}),to_address.in.(${list})`)
        .order("ts", { ascending: false })
        .limit(100);
      return data ?? [];
    },
    refetchInterval: 12_000,
  });

  const rows = activity.data ?? [];

  return (
    <div className="space-y-6">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 sm:flex sm:flex-wrap sm:justify-between">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold tracking-tight sm:text-2xl">Watchlist</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {ready ? `${formatInt(items.length)} saved · stored in this browser` : "Loading…"}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <ExportButton rows={rows as any} filename="watchlist-activity" />
          {items.length > 0 ? (
            <button
              type="button"
              onClick={clear}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition hover:border-destructive/50 hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" /> Clear
            </button>
          ) : null}
        </div>
      </header>

      {ready && items.length === 0 ? (
        <div className="panel grid-etch flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-warning/10 text-warning">
            <Star className="h-5 w-5" />
          </span>
          <h2 className="text-base font-semibold">Nothing on your watchlist yet</h2>
          <p className="max-w-sm text-sm text-muted-foreground">
            Star a wallet, token, merchant or NFT collection anywhere in OpenLedger and it will appear here with a
            combined live activity feed.
          </p>
          <Link
            to="/explorer"
            className="mt-2 inline-flex items-center rounded-md bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90"
          >
            Browse the explorer
          </Link>
        </div>
      ) : null}

      {items.length > 0 ? (
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => {
            const meta = KIND_META[item.kind];
            return (
              <div key={`${item.kind}:${item.id}`} className="panel panel-hover p-3">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                      {meta.icon} {meta.label}
                    </div>
                    <div className="mt-1.5 truncate text-sm font-medium">{item.label ?? item.id}</div>
                    <div className="truncate font-mono text-[10px] text-muted-foreground">{item.id}</div>
                  </div>
                  <button
                    type="button"
                    aria-label="Remove"
                    onClick={() => remove(item.kind, item.id)}
                    className="shrink-0 rounded-md p-1.5 text-muted-foreground transition hover:bg-muted hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="mt-3">
                  {item.kind === "wallet" ? (
                    <Link
                      to="/wallet/$address"
                      params={{ address: item.id }}
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      Open wallet →
                    </Link>
                  ) : item.kind === "token" ? (
                    <Link
                      to="/tokens/$symbol"
                      params={{ symbol: item.id }}
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      Open token →
                    </Link>
                  ) : item.kind === "merchant" ? (
                    <Link
                      to="/merchants/$id"
                      params={{ id: item.id }}
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      Open merchant →
                    </Link>
                  ) : (
                    <Link
                      to="/nft/$slug"
                      params={{ slug: item.id }}
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      Open collection →
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </section>
      ) : null}

      {wallets.length > 0 ? (
        <section>
          <h2 className="mb-3 text-sm font-semibold">Combined wallet activity</h2>
          <TxTable rows={rows as any} dense loading={activity.isLoading} />
        </section>
      ) : null}
    </div>
  );
}
