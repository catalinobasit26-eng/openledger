import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { LayoutGrid, List as ListIcon, ImageOff } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { PageLoader } from "@/components/page-loader";
import { formatInt, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/nft/")({
  head: () => ({
    meta: [
      { title: "NFTs — OpenLedger" },
      { name: "description", content: "NFT collections, mints, sales, and transfers on the OpenPay ledger." },
    ],
  }),
  component: NftIndex,
});

type View = "grid" | "list";

const COLLECTION_COLS =
  "id, slug, name, description, total_supply, owners, floor_price, volume, creator_address";

function CoverImage({ src, alt, className }: { src?: string | null; alt: string; className?: string }) {
  const [errored, setErrored] = useState(false);
  const safe = src && /^https?:\/\//i.test(src) ? src : null;
  if (!safe || errored) {
    return (
      <div className={cn("grid place-items-center bg-muted text-muted-foreground", className)}>
        <ImageOff className="h-6 w-6 opacity-50" />
      </div>
    );
  }
  return (
    <img
      src={safe}
      alt={alt}
      loading="lazy"
      onError={() => setErrored(true)}
      className={cn("h-full w-full object-cover", className)}
    />
  );
}

function NftIndex() {
  const [view, setView] = useState<View>("grid");
  useEffect(() => {
    const saved = localStorage.getItem("nft-view");
    if (saved === "grid" || saved === "list") setView(saved);
  }, []);
  useEffect(() => { localStorage.setItem("nft-view", view); }, [view]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["nft-collections"],
    queryFn: async () => {
      // Prefer RPC that strips data-URLs; fall back to a light column select (avoid SELECT * timeouts).
      const rpc = await supabase.rpc("list_nft_collections" as any);
      if (!rpc.error && Array.isArray(rpc.data)) return rpc.data;

      const { data, error } = await supabase
        .from("nft_collections")
        .select(COLLECTION_COLS)
        .order("volume", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const collections = data ?? [];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 sm:flex sm:flex-wrap sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold tracking-tight">NFT Collections</h1>
          <p className="mt-1 text-sm text-muted-foreground">Mint, sale, and transfer activity across OpenPay NFT collections.</p>
        </div>
        <div className="inline-flex shrink-0 rounded-lg border border-border bg-card p-1">
          <button
            onClick={() => setView("grid")}
            className={cn("inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition",
              view === "grid" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
            aria-pressed={view === "grid"}
            aria-label="Grid view"
          >
            <LayoutGrid className="h-3.5 w-3.5" /> Grid
          </button>
          <button
            onClick={() => setView("list")}
            className={cn("inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition",
              view === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
            aria-pressed={view === "list"}
            aria-label="List view"
          >
            <ListIcon className="h-3.5 w-3.5" /> List
          </button>
        </div>
      </div>

      {isLoading ? <PageLoader label="Loading collections…" /> : null}
      {error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          Failed to load collections. {(error as Error).message}
        </div>
      ) : null}

      {!isLoading && !error && view === "grid" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {collections.map((c: any) => (
            <Link
              key={c.id}
              to="/nft/$slug"
              params={{ slug: c.slug }}
              className="group overflow-hidden rounded-xl border border-border bg-card transition hover:border-primary/40 hover:shadow-lg animate-fade-up"
            >
              <CoverImage src={c.image_url} alt={c.name} className="aspect-square transition group-hover:scale-[1.02]" />
              <div className="p-4">
                <div className="truncate font-semibold">{c.name}</div>
                {c.description ? (
                  <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">{c.description}</div>
                ) : null}
                <div className="mt-3 grid grid-cols-3 gap-2 border-t border-border pt-3 text-xs">
                  <div><div className="text-muted-foreground">Supply</div><div className="font-medium tabular-nums">{formatInt(c.total_supply)}</div></div>
                  <div><div className="text-muted-foreground">Owners</div><div className="font-medium tabular-nums">{formatInt(c.owners)}</div></div>
                  <div><div className="text-muted-foreground">Floor</div><div className="font-medium tabular-nums">{formatNumber(c.floor_price)}</div></div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : null}

      {!isLoading && !error && view === "list" ? (
        <div className="overflow-hidden rounded-xl border border-border bg-card animate-fade-up">
          <div className="hidden grid-cols-[64px_minmax(0,1fr)_repeat(4,minmax(0,120px))] gap-3 border-b border-border bg-muted/50 px-4 py-2 text-[11px] uppercase tracking-wider text-muted-foreground sm:grid">
            <div />
            <div>Collection</div>
            <div className="text-right">Supply</div>
            <div className="text-right">Owners</div>
            <div className="text-right">Floor</div>
            <div className="text-right">Volume</div>
          </div>
          <ul className="divide-y divide-border">
            {collections.map((c: any) => (
              <li key={c.id}>
                <Link
                  to="/nft/$slug"
                  params={{ slug: c.slug }}
                  className="grid grid-cols-[48px_minmax(0,1fr)] items-center gap-3 px-4 py-3 transition hover:bg-muted/40 sm:grid-cols-[64px_minmax(0,1fr)_repeat(4,minmax(0,120px))]"
                >
                  <CoverImage src={c.image_url} alt={c.name} className="aspect-square shrink-0 rounded-md" />
                  <div className="min-w-0">
                    <div className="truncate font-medium">{c.name}</div>
                    {c.description ? (
                      <div className="truncate text-xs text-muted-foreground">{c.description}</div>
                    ) : null}
                    <div className="mt-1 flex gap-3 text-[11px] text-muted-foreground sm:hidden">
                      <span>Supply {formatInt(c.total_supply)}</span>
                      <span>Owners {formatInt(c.owners)}</span>
                      <span>Floor {formatNumber(c.floor_price)}</span>
                    </div>
                  </div>
                  <div className="hidden text-right text-sm tabular-nums sm:block">{formatInt(c.total_supply)}</div>
                  <div className="hidden text-right text-sm tabular-nums sm:block">{formatInt(c.owners)}</div>
                  <div className="hidden text-right text-sm tabular-nums sm:block">{formatNumber(c.floor_price)}</div>
                  <div className="hidden text-right text-sm tabular-nums sm:block">{formatNumber(c.volume)}</div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {!isLoading && !error && collections.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
          No collections yet. Auto-sync will populate this list from OpenPay NFT shortly.
        </div>
      ) : null}
    </div>
  );
}
