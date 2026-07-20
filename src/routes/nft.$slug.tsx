import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { StatCard } from "@/components/stat-card";
import { formatInt, formatNumber, shortAddress, timeAgo } from "@/lib/format";

export const Route = createFileRoute("/nft/$slug")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.slug} — OpenPay NFT` },
      { name: "description", content: `Activity for the ${params.slug} NFT collection on OpenPay.` },
    ],
  }),
  component: NftDetail,
});

function NftDetail() {
  const { slug } = Route.useParams();
  const coll = useQuery({
    queryKey: ["nft-coll", slug],
    queryFn: async () => {
      const { data } = await supabase.from("nft_collections").select("*").eq("slug", slug).maybeSingle();
      return data;
    },
  });
  const events = useQuery({
    enabled: !!coll.data?.id,
    queryKey: ["nft-events", coll.data?.id],
    queryFn: async () => {
      const { data } = await supabase.from("nft_transactions").select("*").eq("collection_id", coll.data!.id).order("ts", { ascending: false }).limit(100);
      return data ?? [];
    },
  });
  const c = coll.data;
  if (!c) return <div className="text-sm text-muted-foreground">Collection not found.</div>;
  return (
    <div className="space-y-6">
      <div className="grid gap-6 sm:grid-cols-[160px_minmax(0,1fr)] sm:items-start">
        {c.image_url ? (
          <img src={c.image_url} alt={c.name} loading="lazy" className="aspect-square w-full max-w-[160px] rounded-xl border border-border object-cover" />
        ) : (
          <div className="aspect-square w-full max-w-[160px] rounded-xl border border-dashed border-border bg-muted" />
        )}
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">NFT Collection</div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight break-words">{c.name}</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{c.description}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Supply" value={formatInt(c.total_supply)} />
        <StatCard label="Owners" value={formatInt(c.owners)} />
        <StatCard label="Floor" value={`${formatNumber(c.floor_price)} OUSD`} />
        <StatCard label="Volume" value={`${formatNumber(c.volume)} OUSD`} />
      </div>
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Event</th>
              <th className="px-4 py-3">Token</th>
              <th className="px-4 py-3">From</th>
              <th className="px-4 py-3">To</th>
              <th className="px-4 py-3 text-right">Price</th>
              <th className="px-4 py-3">When</th>
            </tr>
          </thead>
          <tbody>
            {(events.data ?? []).map((e: any) => (
              <tr key={e.id} className="border-t border-border">
                <td className="px-4 py-3 capitalize">{e.event_type}</td>
                <td className="px-4 py-3 font-mono text-xs">#{e.token_id}</td>
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{shortAddress(e.from_address)}</td>
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{shortAddress(e.to_address)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{formatNumber(e.price)} {e.currency}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{timeAgo(e.ts)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
