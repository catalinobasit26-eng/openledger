import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { StatCard } from "@/components/stat-card";
import { NftCover } from "@/components/nft-cover";
import { PageLoader } from "@/components/page-loader";
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

const COLLECTION_COLS =
  "id, slug, name, description, total_supply, owners, floor_price, volume, creator_address";

function NftDetail() {
  const { slug } = Route.useParams();
  const coll = useQuery({
    queryKey: ["nft-coll", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("nft_collections")
        .select(COLLECTION_COLS)
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const events = useQuery({
    enabled: !!coll.data?.id,
    queryKey: ["nft-events", coll.data?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("nft_transactions")
        .select("id, event_type, token_id, from_address, to_address, price, currency, ts")
        .eq("collection_id", coll.data!.id)
        .order("ts", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });

  if (coll.isLoading) return <PageLoader label="Loading collection…" />;
  const c = coll.data;
  if (!c) return <div className="text-sm text-muted-foreground">Collection not found.</div>;

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="grid gap-6 sm:grid-cols-[160px_minmax(0,1fr)] sm:items-start">
        <NftCover
          slug={c.slug}
          collectionId={c.id}
          name={c.name}
          className="aspect-square w-full max-w-40 rounded-xl border border-border"
        />
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">NFT Collection</div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight wrap-break-word">{c.name}</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground wrap-break-word whitespace-pre-wrap">{c.description}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Supply" value={formatInt(c.total_supply)} />
        <StatCard label="Owners" value={formatInt(c.owners)} />
        <StatCard label="Floor" value={`${formatNumber(c.floor_price)} OUSD`} />
        <StatCard label="Volume" value={`${formatNumber(c.volume)} OUSD`} />
      </div>
      <div className="rounded-xl border border-border bg-card">
        {/* Mobile: stacked cards so every field is visible without horizontal crush */}
        <ul className="divide-y divide-border sm:hidden">
          {(events.data ?? []).map((e: any) => (
            <li key={e.id} className="space-y-2 px-4 py-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="capitalize font-medium">{e.event_type}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(e.ts)}</span>
              </div>
              <div className="font-mono text-xs text-muted-foreground">Token #{e.token_id}</div>
              <div className="grid gap-1 text-xs">
                <div className="flex gap-2 min-w-0">
                  <span className="shrink-0 text-muted-foreground">From</span>
                  <span className="font-mono break-all">{e.from_address || "—"}</span>
                </div>
                <div className="flex gap-2 min-w-0">
                  <span className="shrink-0 text-muted-foreground">To</span>
                  <span className="font-mono break-all">{e.to_address || "—"}</span>
                </div>
                <div className="flex gap-2">
                  <span className="shrink-0 text-muted-foreground">Price</span>
                  <span className="tabular-nums font-medium">{formatNumber(e.price)} {e.currency}</span>
                </div>
              </div>
            </li>
          ))}
          {!events.isLoading && (events.data ?? []).length === 0 ? (
            <li className="px-4 py-8 text-center text-sm text-muted-foreground">No activity recorded yet.</li>
          ) : null}
        </ul>

        {/* sm+: horizontal slide to keep all columns readable */}
        <div className="hidden table-scroll sm:block">
          <table className="w-full min-w-160 text-sm">
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
                  <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap">{formatNumber(e.price)} {e.currency}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{timeAgo(e.ts)}</td>
                </tr>
              ))}
              {!events.isLoading && (events.data ?? []).length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No activity recorded yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
