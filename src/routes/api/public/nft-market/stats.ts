import { createFileRoute } from "@tanstack/react-router";

import { fetchNftStats } from "@/lib/nft-public-api";

export const Route = createFileRoute("/api/public/nft-market/stats")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const data = await fetchNftStats();
          return Response.json(data);
        } catch (e) {
          return Response.json(
            { error: e instanceof Error ? e.message : "Failed to fetch NFT stats" },
            { status: 502 },
          );
        }
      },
    },
  },
});
