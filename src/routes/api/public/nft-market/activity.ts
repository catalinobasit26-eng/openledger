import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { fetchNftActivity, type ActivityKind } from "@/lib/nft-public-api";

const kindSchema = z.enum(["all", "mints", "sales", "auctions", "gifts"]).catch("all");

export const Route = createFileRoute("/api/public/nft-market/activity")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const kind = kindSchema.parse(url.searchParams.get("kind") ?? "all") as ActivityKind;
        const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") || 40)));
        const offset = Math.max(0, Number(url.searchParams.get("offset") || 0));
        try {
          const data = await fetchNftActivity(kind, limit, offset);
          return Response.json(data);
        } catch (e) {
          return Response.json(
            { error: e instanceof Error ? e.message : "Failed to fetch NFT activity" },
            { status: 502 },
          );
        }
      },
    },
  },
});
