import { createFileRoute } from "@tanstack/react-router";

import { fetchNftListings } from "@/lib/nft-public-api";

export const Route = createFileRoute("/api/public/nft-market/listings")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const status = url.searchParams.get("status") || "active";
        const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") || 24)));
        const offset = Math.max(0, Number(url.searchParams.get("offset") || 0));
        try {
          const data = await fetchNftListings(status, limit, offset);
          return Response.json(data);
        } catch (e) {
          return Response.json(
            { error: e instanceof Error ? e.message : "Failed to fetch NFT listings" },
            { status: 502 },
          );
        }
      },
    },
  },
});
