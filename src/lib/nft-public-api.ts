/** OpenPay NFT Public API — https://openpy.space/web3/nft/api */

import { pickRemoteImageUrl, sanitizeMetadataImages } from "@/lib/media";

export const NFT_PUBLIC_API_BASE =
  "https://araojncyittkahvvpdrn.supabase.co/functions/v1/nft-public-api";

export const NFT_API_DOCS = "https://openpy.space/web3/nft/api";
export const NFT_MARKETPLACE_URL = "https://openpy.space/web3/nft";

export type NftMarketStats = {
  collections: number;
  active_items: number;
  stores: number;
  owner_records: number;
  mints: number;
  sales: number;
  auctions: number;
  live_auctions: number;
  active_listings: number;
  total_volume: Record<string, number>;
  volume_by_kind?: Record<string, Record<string, number>>;
  marketplace_url?: string;
  generated_at?: string;
};

export type NftParty = {
  user_id?: string | null;
  handle?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
  is_verified?: boolean;
  url?: string | null;
};

export type NftStore = {
  handle?: string;
  display_name?: string;
  avatar_url?: string | null;
  is_verified?: boolean;
  url?: string | null;
};

export type NftItemRef = {
  id?: string;
  name?: string;
  code?: string;
  image?: string | null;
  image_url?: string | null;
  media_url?: string | null;
  collection_id?: string;
  creator_id?: string;
  permalink?: string | null;
  collection_url?: string | null;
  store?: NftStore | null;
};

export type NftActivity = {
  id: string;
  type: string;
  status?: string;
  quantity?: number;
  price_each?: number;
  total?: number;
  royalty_amount?: number;
  platform_fee?: number;
  currency?: string;
  payment_method?: string;
  seller_id?: string | null;
  buyer_id?: string | null;
  seller?: NftParty | null;
  buyer?: NftParty | null;
  created_at: string;
  item?: NftItemRef | null;
  marketplace_url?: string;
};

export type NftCollectionLive = {
  id: string;
  name: string;
  code?: string;
  description?: string | null;
  cover_url?: string | null;
  image_url?: string | null;
  banner_url?: string | null;
  thumbnail_url?: string | null;
  creator_id?: string | null;
  item_count?: number;
  store?: NftStore | null;
  permalink?: string | null;
};

export type NftListing = {
  id: string;
  item_id?: string;
  seller_id?: string;
  price: number;
  quantity?: number;
  currency?: string;
  status?: string;
  created_at: string;
  item?: NftItemRef | null;
  seller?: NftParty | null;
};

export type ActivityKind = "all" | "mints" | "sales" | "auctions" | "gifts";

function activityPath(kind: ActivityKind): string {
  if (kind === "all") return "/activity";
  return `/activity/${kind}`;
}

async function nftGet<T>(path: string, query: Record<string, string | number | undefined> = {}): Promise<T> {
  const url = new URL(`${NFT_PUBLIC_API_BASE}${path.startsWith("/") ? path : `/${path}`}`);
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === "") continue;
    url.searchParams.set(k, String(v));
  }
  const res = await fetch(url.toString(), { headers: { Accept: "application/json" } });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`NFT API ${res.status}: ${body.slice(0, 200) || res.statusText}`);
  }
  return res.json() as Promise<T>;
}

/** Strip inline base64 images so responses stay small for the browser. */
export function sanitizeNftApiPayload<T>(input: T): T {
  return sanitizeMetadataImages(input, null as unknown as string);
}

export function nftItemThumb(item: NftItemRef | null | undefined): string | null {
  if (!item) return null;
  return pickRemoteImageUrl(item.image_url, item.media_url, item.image);
}

export function nftCollectionThumb(c: NftCollectionLive): string | null {
  return pickRemoteImageUrl(c.image_url, c.cover_url, c.thumbnail_url, c.banner_url);
}

export function classifyNftActivity(type: string | null | undefined): string {
  const t = (type ?? "").toLowerCase();
  if (t.includes("mint")) return "mint";
  if (t.includes("gift")) return "gift";
  if (t.includes("auction")) return "auction";
  if (t.includes("sale") || t === "resale" || t === "primary_sale") return "sale";
  if (t.includes("bid")) return "bid";
  return t || "transfer";
}

export async function fetchNftStats() {
  return sanitizeNftApiPayload(await nftGet<NftMarketStats>("/stats"));
}

export async function fetchNftActivity(kind: ActivityKind = "all", limit = 40, offset = 0) {
  const body = await nftGet<{ activity?: NftActivity[]; data?: NftActivity[] }>(activityPath(kind), {
    limit,
    offset,
  });
  const activity = Array.isArray(body.activity) ? body.activity : Array.isArray(body.data) ? body.data : [];
  return sanitizeNftApiPayload({ activity });
}

export async function fetchNftCollectionsLive(limit = 24, offset = 0) {
  const body = await nftGet<{ collections?: NftCollectionLive[]; data?: NftCollectionLive[] }>("/collections", {
    limit,
    offset,
  });
  const collections = Array.isArray(body.collections)
    ? body.collections
    : Array.isArray(body.data)
      ? body.data
      : [];
  return sanitizeNftApiPayload({ collections });
}

export async function fetchNftListings(status = "active", limit = 24, offset = 0) {
  const body = await nftGet<{ listings?: NftListing[]; data?: NftListing[] }>("/listings", {
    status,
    limit,
    offset,
  });
  const listings = Array.isArray(body.listings) ? body.listings : Array.isArray(body.data) ? body.data : [];
  return sanitizeNftApiPayload({ listings });
}
