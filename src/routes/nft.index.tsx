import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  ExternalLink,
  Gavel,
  ImageIcon,
  LayoutGrid,
  List as ListIcon,
  ShoppingBag,
  Sparkles,
} from "lucide-react";
import { z } from "zod";

import { supabase } from "@/integrations/supabase/client";
import { TypeBadge } from "@/components/badges";
import { NftCover } from "@/components/nft-cover";
import { PageLoader } from "@/components/page-loader";
import { StatCard } from "@/components/stat-card";
import {
  classifyNftActivity,
  NFT_API_DOCS,
  NFT_MARKETPLACE_URL,
  nftCollectionThumb,
  nftItemThumb,
  type ActivityKind,
  type NftActivity,
  type NftCollectionLive,
  type NftListing,
  type NftMarketStats,
} from "@/lib/nft-public-api";
import { formatInt, formatNumber, formatUsd, shortHash, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";

const searchSchema = z.object({
  tab: z.enum(["collections", "activity", "listings"]).optional().catch("collections"),
  kind: z.enum(["all", "mints", "sales", "auctions", "gifts"]).optional().catch("all"),
});

export const Route = createFileRoute("/nft/")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "NFTs — OpenLedger" },
      {
        name: "description",
        content:
          "Live OpenPay NFT marketplace — collections, mints, sales, auctions, gifts, and listings via the public NFT API.",
      },
    ],
  }),
  component: NftIndex,
});

type View = "grid" | "list";

const COLLECTION_COLS =
  "id, slug, name, description, total_supply, owners, floor_price, volume, creator_address";

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const body = (await res.json()) as T & { error?: string };
  if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
  return body;
}

function NftIndex() {
  const { tab = "collections", kind = "all" } = Route.useSearch();
  const navigate = Route.useNavigate();
  const [view, setView] = useState<View>("grid");

  useEffect(() => {
    const saved = localStorage.getItem("nft-view");
    if (saved === "grid" || saved === "list") setView(saved);
  }, []);
  useEffect(() => {
    localStorage.setItem("nft-view", view);
  }, [view]);

  const stats = useQuery({
    queryKey: ["nft-market-stats"],
    queryFn: () => getJson<NftMarketStats>("/api/public/nft-market/stats"),
    refetchInterval: 30_000,
  });

  const localCollections = useQuery({
    queryKey: ["nft-collections"],
    queryFn: async () => {
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

  const liveCollections = useQuery({
    enabled: tab === "collections",
    queryKey: ["nft-market-collections"],
    queryFn: () => getJson<{ collections: NftCollectionLive[] }>("/api/public/nft-market/collections?limit=24"),
    refetchInterval: 60_000,
  });

  const activity = useQuery({
    enabled: tab === "activity",
    queryKey: ["nft-market-activity", kind],
    queryFn: () =>
      getJson<{ activity: NftActivity[] }>(
        `/api/public/nft-market/activity?kind=${encodeURIComponent(kind)}&limit=40`,
      ),
    refetchInterval: 20_000,
  });

  const listings = useQuery({
    enabled: tab === "listings",
    queryKey: ["nft-market-listings"],
    queryFn: () =>
      getJson<{ listings: NftListing[] }>("/api/public/nft-market/listings?status=active&limit=40"),
    refetchInterval: 30_000,
  });

  const setTab = (next: "collections" | "activity" | "listings") =>
    navigate({ to: "/nft", search: (prev) => ({ ...prev, tab: next }) });

  const setKind = (next: ActivityKind) =>
    navigate({ to: "/nft", search: (prev) => ({ ...prev, tab: "activity", kind: next }) });

  const s = stats.data;
  const volumeOusd = Number(s?.total_volume?.OUSD ?? 0);
  const collections = localCollections.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex items-start gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs uppercase tracking-wider text-muted-foreground">OpenPay NFT</span>
              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                LIVE · v2
              </span>
            </div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight">NFT Marketplace</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Public read-only feed of collections, mints, sales, auctions, gifts, and listings — powered by the{" "}
              <a href={NFT_API_DOCS} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                OpenPay NFT API
              </a>
              .
            </p>
            <div className="mt-2 flex flex-wrap gap-3 text-xs">
              <a
                href={NFT_MARKETPLACE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                Marketplace <ExternalLink className="h-3 w-3" />
              </a>
              <a
                href={NFT_API_DOCS}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                API docs <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-6">
        <StatCard label="Collections" value={formatInt(s?.collections)} loading={stats.isLoading} icon={<LayoutGrid className="h-4 w-4" />} />
        <StatCard label="Active items" value={formatInt(s?.active_items)} loading={stats.isLoading} icon={<ImageIcon className="h-4 w-4" />} />
        <StatCard label="Mints" value={formatInt(s?.mints)} loading={stats.isLoading} />
        <StatCard label="Sales" value={formatInt(s?.sales)} loading={stats.isLoading} icon={<ShoppingBag className="h-4 w-4" />} />
        <StatCard
          label="Auctions"
          value={formatInt(s?.auctions)}
          sub={`${formatInt(s?.live_auctions)} live`}
          loading={stats.isLoading}
          icon={<Gavel className="h-4 w-4" />}
        />
        <StatCard
          label="Volume"
          value={formatUsd(volumeOusd)}
          sub={`${formatInt(s?.active_listings)} active listings`}
          loading={stats.isLoading}
        />
      </div>

      {stats.isError ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          Live marketplace stats unavailable. {(stats.error as Error).message}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-1 border-b border-border pb-px">
        {(
          [
            { id: "collections" as const, label: "Collections" },
            { id: "activity" as const, label: "Activity" },
            { id: "listings" as const, label: "Listings" },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "rounded-t-md px-4 py-2 text-sm transition",
              tab === t.id
                ? "border border-b-0 border-border bg-card font-medium text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "collections" ? (
        <CollectionsSection
          view={view}
          setView={setView}
          local={collections}
          localLoading={localCollections.isLoading}
          localError={localCollections.error as Error | null}
          live={liveCollections.data?.collections ?? []}
          liveLoading={liveCollections.isLoading}
          liveError={liveCollections.error as Error | null}
        />
      ) : null}

      {tab === "activity" ? (
        <ActivitySection
          kind={kind}
          onKind={setKind}
          rows={activity.data?.activity ?? []}
          loading={activity.isLoading}
          error={activity.error as Error | null}
        />
      ) : null}

      {tab === "listings" ? (
        <ListingsSection
          rows={listings.data?.listings ?? []}
          loading={listings.isLoading}
          error={listings.error as Error | null}
        />
      ) : null}
    </div>
  );
}

function CollectionsSection({
  view,
  setView,
  local,
  localLoading,
  localError,
  live,
  liveLoading,
  liveError,
}: {
  view: View;
  setView: (v: View) => void;
  local: any[];
  localLoading: boolean;
  localError: Error | null;
  live: NftCollectionLive[];
  liveLoading: boolean;
  liveError: Error | null;
}) {
  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">Ledger collections</h2>
            <p className="text-xs text-muted-foreground">Synced into OpenLedger for explorer detail pages.</p>
          </div>
          <div className="inline-flex shrink-0 rounded-lg border border-border bg-card p-1">
            <button
              type="button"
              onClick={() => setView("grid")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition",
                view === "grid" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <LayoutGrid className="h-3.5 w-3.5" /> Grid
            </button>
            <button
              type="button"
              onClick={() => setView("list")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition",
                view === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <ListIcon className="h-3.5 w-3.5" /> List
            </button>
          </div>
        </div>

        {localLoading ? <PageLoader label="Loading collections…" className="min-h-[30vh]" /> : null}
        {localError ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            Failed to load ledger collections. {localError.message}
          </div>
        ) : null}

        {!localLoading && !localError && view === "grid" ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {local.map((c: any) => (
              <Link
                key={c.id}
                to="/nft/$slug"
                params={{ slug: c.slug }}
                className="group overflow-hidden rounded-xl border border-border bg-card transition hover:border-primary/40 hover:shadow-lg animate-fade-up"
              >
                <NftCover slug={c.slug} collectionId={c.id} name={c.name} className="aspect-square transition group-hover:scale-[1.02]" />
                <div className="p-4">
                  <div className="truncate font-semibold">{c.name}</div>
                  {c.description ? <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">{c.description}</div> : null}
                  <div className="mt-3 grid grid-cols-3 gap-2 border-t border-border pt-3 text-xs">
                    <div>
                      <div className="text-muted-foreground">Supply</div>
                      <div className="font-medium tabular-nums">{formatInt(c.total_supply)}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Owners</div>
                      <div className="font-medium tabular-nums">{formatInt(c.owners)}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Floor</div>
                      <div className="font-medium tabular-nums">{formatNumber(c.floor_price)}</div>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : null}

        {!localLoading && !localError && view === "list" ? (
          <div className="overflow-hidden rounded-xl border border-border bg-card animate-fade-up">
            <ul className="divide-y divide-border">
              {local.map((c: any) => (
                <li key={c.id}>
                  <Link
                    to="/nft/$slug"
                    params={{ slug: c.slug }}
                    className="grid grid-cols-[48px_minmax(0,1fr)] items-center gap-3 px-4 py-3 transition hover:bg-muted/40 sm:grid-cols-[64px_minmax(0,1fr)_repeat(4,minmax(0,120px))]"
                  >
                    <NftCover slug={c.slug} collectionId={c.id} name={c.name} className="aspect-square shrink-0 rounded-md" />
                    <div className="min-w-0">
                      <div className="truncate font-medium">{c.name}</div>
                      {c.description ? <div className="truncate text-xs text-muted-foreground">{c.description}</div> : null}
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

        {!localLoading && !localError && local.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
            No ledger collections yet — live marketplace feed below still updates from the public API.
          </div>
        ) : null}
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold">Live marketplace collections</h2>
          <p className="text-xs text-muted-foreground">Direct from NFT Public API · covers use remote URLs only.</p>
        </div>
        {liveLoading ? <PageLoader label="Loading live collections…" className="min-h-[20vh]" /> : null}
        {liveError ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {liveError.message}
          </div>
        ) : null}
        {!liveLoading && !liveError ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {live.map((c) => {
              const thumb = nftCollectionThumb(c);
              const slug = String(c.id ?? c.code ?? "").toLowerCase();
              return (
                <div key={c.id} className="flex gap-3 rounded-xl border border-border bg-card p-3">
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-muted">
                    {thumb ? (
                      <img src={thumb} alt="" className="h-full w-full object-cover" loading="lazy" />
                    ) : (
                      <div className="grid h-full place-items-center text-xs font-semibold text-muted-foreground">
                        {(c.name || "?").slice(0, 1)}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{c.name}</div>
                    {c.store?.display_name || c.store?.handle ? (
                      <div className="truncate text-xs text-muted-foreground">
                        {c.store.display_name || `@${c.store.handle}`}
                        {c.store.is_verified ? " · verified" : ""}
                      </div>
                    ) : null}
                    <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                      {slug ? (
                        <Link to="/nft/$slug" params={{ slug }} className="font-medium text-primary hover:underline">
                          Open in ledger
                        </Link>
                      ) : null}
                      {c.permalink ? (
                        <a href={c.permalink} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                          Marketplace
                        </a>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
            {live.length === 0 ? (
              <div className="col-span-full rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                No live collections returned.
              </div>
            ) : null}
          </div>
        ) : null}
      </section>
    </div>
  );
}

function ActivitySection({
  kind,
  onKind,
  rows,
  loading,
  error,
}: {
  kind: ActivityKind;
  onKind: (k: ActivityKind) => void;
  rows: NftActivity[];
  loading: boolean;
  error: Error | null;
}) {
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">Marketplace activity</h2>
          <p className="text-xs text-muted-foreground">Mints, sales, auctions, and gifts from the public feed.</p>
        </div>
        <div className="flex flex-wrap gap-1">
          {(
            [
              { id: "all" as const, label: "All" },
              { id: "mints" as const, label: "Mints" },
              { id: "sales" as const, label: "Sales" },
              { id: "auctions" as const, label: "Auctions" },
              { id: "gifts" as const, label: "Gifts" },
            ] as const
          ).map((k) => (
            <button
              key={k.id}
              type="button"
              onClick={() => onKind(k.id)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition",
                kind === k.id ? "bg-primary text-primary-foreground" : "border border-border bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              {k.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? <PageLoader label="Loading activity…" className="min-h-[30vh]" /> : null}
      {error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{error.message}</div>
      ) : null}

      {!loading && !error ? (
        <div className="rounded-xl border border-border bg-card">
          <ul className="divide-y divide-border sm:hidden">
            {rows.map((ev) => (
              <ActivityMobileCard key={ev.id} ev={ev} />
            ))}
            {rows.length === 0 ? (
              <li className="px-4 py-8 text-center text-sm text-muted-foreground">No activity in this feed.</li>
            ) : null}
          </ul>

          <div className="table-scroll hidden sm:block">
            <table className="w-full min-w-5xl text-sm">
              <thead className="bg-muted/50 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Item</th>
                  <th className="px-4 py-3">From</th>
                  <th className="px-4 py-3">To</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3">Age</th>
                  <th className="sticky right-0 z-10 bg-muted/95 px-3 py-3 text-right shadow-[-8px_0_12px_-8px_rgba(0,0,0,0.15)]">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((ev) => (
                  <ActivityRow key={ev.id} ev={ev} />
                ))}
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-sm text-muted-foreground">
                      No activity in this feed.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function partyLabel(p?: { handle?: string | null; display_name?: string | null; user_id?: string | null } | null) {
  if (!p) return "—";
  return p.display_name || (p.handle ? `@${p.handle}` : p.user_id ? shortHash(p.user_id, 6, 4) : "—");
}

function ActivityMobileCard({ ev }: { ev: NftActivity }) {
  const kind = classifyNftActivity(ev.type);
  const thumb = nftItemThumb(ev.item);
  return (
    <li className="space-y-2 px-4 py-3">
      <div className="flex items-start justify-between gap-2">
        <TypeBadge type={kind} />
        <span className="text-xs text-muted-foreground">{timeAgo(ev.created_at)}</span>
      </div>
      <div className="flex gap-3">
        <Thumb src={thumb} label={ev.item?.name} />
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium">{ev.item?.name || "Untitled item"}</div>
          <div className="text-xs text-muted-foreground">
            {partyLabel(ev.seller)} → {partyLabel(ev.buyer)}
          </div>
          <div className="mt-1 font-semibold tabular-nums">
            {formatNumber(ev.total ?? ev.price_each ?? 0)} {ev.currency || "OUSD"}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 text-[11px]">
        <Link to="/tx/$hash" params={{ hash: ev.id }} className="font-medium text-primary hover:underline">
          View on ledger
        </Link>
        {ev.item?.permalink ? (
          <a href={ev.item.permalink} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
            Marketplace
          </a>
        ) : null}
      </div>
    </li>
  );
}

function ActivityRow({ ev }: { ev: NftActivity }) {
  const kind = classifyNftActivity(ev.type);
  const thumb = nftItemThumb(ev.item);
  return (
    <tr className="border-t border-border hover:bg-muted/30 group">
      <td className="px-4 py-3">
        <TypeBadge type={kind} />
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2 min-w-0">
          <Thumb src={thumb} label={ev.item?.name} className="h-9 w-9" />
          <div className="min-w-0">
            <div className="truncate font-medium">{ev.item?.name || "Untitled"}</div>
            {ev.item?.code ? <div className="truncate text-[11px] text-muted-foreground">{ev.item.code}</div> : null}
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-xs text-muted-foreground">{partyLabel(ev.seller)}</td>
      <td className="px-4 py-3 text-xs text-muted-foreground">{partyLabel(ev.buyer)}</td>
      <td className="px-4 py-3 text-right font-medium tabular-nums whitespace-nowrap">
        {formatNumber(ev.total ?? ev.price_each ?? 0)} {ev.currency || "OUSD"}
      </td>
      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{timeAgo(ev.created_at)}</td>
      <td className="sticky right-0 z-10 bg-card px-3 py-3 text-right shadow-[-8px_0_12px_-8px_rgba(0,0,0,0.12)] group-hover:bg-muted/80">
        <Link
          to="/tx/$hash"
          params={{ hash: ev.id }}
          className="inline-flex items-center rounded-md bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary whitespace-nowrap hover:bg-primary/15"
        >
          View
        </Link>
      </td>
    </tr>
  );
}

function ListingsSection({
  rows,
  loading,
  error,
}: {
  rows: NftListing[];
  loading: boolean;
  error: Error | null;
}) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold">Active listings</h2>
        <p className="text-xs text-muted-foreground">Live marketplace listings from the public NFT API.</p>
      </div>
      {loading ? <PageLoader label="Loading listings…" className="min-h-[30vh]" /> : null}
      {error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{error.message}</div>
      ) : null}
      {!loading && !error ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((l) => {
            const thumb = nftItemThumb(l.item);
            return (
              <div key={l.id} className="overflow-hidden rounded-xl border border-border bg-card">
                <div className="aspect-4/3 bg-muted">
                  {thumb ? (
                    <img src={thumb} alt="" className="h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <div className="grid h-full place-items-center text-muted-foreground">
                      <ImageIcon className="h-8 w-8 opacity-40" />
                    </div>
                  )}
                </div>
                <div className="space-y-2 p-3">
                  <div className="truncate font-medium">{l.item?.name || "Listing"}</div>
                  <div className="text-sm font-semibold tabular-nums">
                    {formatNumber(l.price)} {l.currency || "OUSD"}
                  </div>
                  <div className="text-xs text-muted-foreground">{timeAgo(l.created_at)}</div>
                  {l.item?.permalink ? (
                    <a
                      href={l.item.permalink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                    >
                      View listing <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : null}
                </div>
              </div>
            );
          })}
          {rows.length === 0 ? (
            <div className="col-span-full rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              No active listings right now.
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function Thumb({
  src,
  label,
  className,
}: {
  src: string | null;
  label?: string | null;
  className?: string;
}) {
  return (
    <div className={cn("relative h-12 w-12 shrink-0 overflow-hidden rounded-md bg-muted", className)}>
      {src ? (
        <img src={src} alt="" className="h-full w-full object-cover" loading="lazy" />
      ) : (
        <div className="grid h-full place-items-center text-[10px] font-semibold text-muted-foreground">
          {(label || "?").slice(0, 1).toUpperCase()}
        </div>
      )}
    </div>
  );
}
