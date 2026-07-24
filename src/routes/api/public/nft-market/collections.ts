import { createFileRoute } from "@tanstack/react-router";

import { fetchNftCollectionsLive } from "@/lib/nft-public-api";

export const Route = createFileRoute("/api/public/nft-market/collections")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") || 24)));
        const offset = Math.max(0, Number(url.searchParams.get("offset") || 0));
        try {
          const data = await fetchNftCollectionsLive(limit, offset);
          return Response.json(data);
        } catch (e) {
          return Response.json(
            { error: e instanceof Error ? e.message : "Failed to fetch NFT collections" },
            { status: 502 },
          );
        }
      },
    },
  },
});
