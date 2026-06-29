import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { formatInt, formatNumber } from "@/lib/format";

export const Route = createFileRoute("/nft/")({
  head: () => ({
    meta: [
      { title: "NFTs — OpenPay Ledger" },
      { name: "description", content: "NFT collections, mints, sales, and transfers on the OpenPay ledger." },
    ],
  }),
  component: NftIndex,
});

function NftIndex() {
  const { data } = useQuery({
    queryKey: ["nft-collections"],
    queryFn: async () => {
      const { data } = await supabase.from("nft_collections").select("*").order("volume", { ascending: false });
      return data ?? [];
    },
  });
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">NFT Collections</h1>
        <p className="mt-1 text-sm text-muted-foreground">Mint, sale, and transfer activity across OpenPay NFT collections.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {(data ?? []).map((c: any) => (
          <Link key={c.id} to="/nft/$slug" params={{ slug: c.slug }} className="rounded-xl border border-border bg-card p-4 transition hover:border-primary/40">
            <div className="font-semibold">{c.name}</div>
            <div className="mt-1 text-xs text-muted-foreground line-clamp-2">{c.description}</div>
            <div className="mt-3 grid grid-cols-3 gap-2 border-t border-border pt-3 text-xs">
              <div><div className="text-muted-foreground">Supply</div><div className="font-medium tabular-nums">{formatInt(c.total_supply)}</div></div>
              <div><div className="text-muted-foreground">Owners</div><div className="font-medium tabular-nums">{formatInt(c.owners)}</div></div>
              <div><div className="text-muted-foreground">Floor</div><div className="font-medium tabular-nums">{formatNumber(c.floor_price)}</div></div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
