import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { StatCard } from "@/components/stat-card";
import { NftCover } from "@/components/nft-cover";
import { PageLoader } from "@/components/page-loader";
import { formatInt, formatNumber, shortAddress, shortHash, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";

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
  const navigate = useNavigate();
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
        .select("id, event_type, token_id, from_address, to_address, price, currency, ts, tx_hash")
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

  const openTx = (hash: string | null | undefined) => {
    if (!hash) return;
    void navigate({ to: "/tx/$hash", params: { hash } });
  };

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
        <ul className="divide-y divide-border sm:hidden">
          {(events.data ?? []).map((e: any) => {
            const clickable = Boolean(e.tx_hash);
            const body = (
              <>
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
                  <div className="flex items-center justify-between gap-2">
                    <span className="tabular-nums font-medium">
                      {formatNumber(e.price)} {e.currency}
                    </span>
                    {clickable ? (
                      <span className="rounded-md bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary">
                        View →
                      </span>
                    ) : null}
                  </div>
                </div>
              </>
            );
            return (
              <li key={e.id}>
                {clickable ? (
                  <Link
                    to="/tx/$hash"
                    params={{ hash: e.tx_hash }}
                    className="block space-y-2 px-4 py-3 text-sm transition hover:bg-muted/40"
                  >
                    {body}
                  </Link>
                ) : (
                  <div className="space-y-2 px-4 py-3 text-sm">{body}</div>
                )}
              </li>
            );
          })}
          {!events.isLoading && (events.data ?? []).length === 0 ? (
            <li className="px-4 py-8 text-center text-sm text-muted-foreground">No activity recorded yet.</li>
          ) : null}
        </ul>

        <div className="hidden table-scroll sm:block">
          <table className="w-full min-w-5xl text-sm">
            <thead className="bg-muted/50 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Event</th>
                <th className="px-4 py-3">Token</th>
                <th className="px-4 py-3">From</th>
                <th className="px-4 py-3">To</th>
                <th className="px-4 py-3 text-right">Price</th>
                <th className="px-4 py-3">Tx</th>
                <th className="px-4 py-3">When</th>
                <th className="sticky right-0 z-10 bg-muted/95 px-3 py-3 text-right shadow-[-8px_0_12px_-8px_rgba(0,0,0,0.15)]">
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {(events.data ?? []).map((e: any) => {
                const clickable = Boolean(e.tx_hash);
                return (
                  <tr
                    key={e.id}
                    role={clickable ? "link" : undefined}
                    tabIndex={clickable ? 0 : undefined}
                    onClick={() => openTx(e.tx_hash)}
                    onKeyDown={(ev) => {
                      if (!clickable) return;
                      if (ev.key === "Enter" || ev.key === " ") {
                        ev.preventDefault();
                        openTx(e.tx_hash);
                      }
                    }}
                    className={cn(
                      "border-t border-border group",
                      clickable && "cursor-pointer hover:bg-muted/30",
                    )}
                  >
                    <td className="px-4 py-3 capitalize">{e.event_type}</td>
                    <td className="px-4 py-3 font-mono text-xs">#{e.token_id}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {e.from_address ? (
                        <Link
                          to="/wallet/$address"
                          params={{ address: e.from_address }}
                          onClick={(ev) => ev.stopPropagation()}
                          className="hover:text-primary"
                        >
                          {shortAddress(e.from_address)}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {e.to_address ? (
                        <Link
                          to="/wallet/$address"
                          params={{ address: e.to_address }}
                          onClick={(ev) => ev.stopPropagation()}
                          className="hover:text-primary"
                        >
                          {shortAddress(e.to_address)}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap">
                      {formatNumber(e.price)} {e.currency}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-primary">
                      {e.tx_hash ? shortHash(e.tx_hash, 8, 6) : "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{timeAgo(e.ts)}</td>
                    <td className="sticky right-0 z-10 bg-card px-3 py-3 text-right shadow-[-8px_0_12px_-8px_rgba(0,0,0,0.12)] group-hover:bg-muted/80">
                      {clickable ? (
                        <span className="inline-flex items-center rounded-md bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary whitespace-nowrap">
                          View
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!events.isLoading && (events.data ?? []).length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-sm text-muted-foreground">
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
