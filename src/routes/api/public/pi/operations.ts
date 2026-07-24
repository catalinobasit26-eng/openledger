import { createFileRoute } from "@tanstack/react-router";

import { fetchOpenLedgerFeed } from "@/lib/openledger-api";

export const Route = createFileRoute("/api/public/pi/operations")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const limit = Number(url.searchParams.get("limit") || 50);
        const offset = Number(url.searchParams.get("offset") || 0);
        const since = url.searchParams.get("since") || undefined;
        try {
          const data = await fetchOpenLedgerFeed({
            limit: Math.min(500, Math.max(1, Number.isFinite(limit) ? limit : 50)),
            offset: Math.max(0, Number.isFinite(offset) ? offset : 0),
            since,
          });
          return Response.json(data);
        } catch (e) {
          return Response.json(
            { error: e instanceof Error ? e.message : "Failed to fetch OpenLedger operations" },
            { status: 502 },
          );
        }
      },
    },
  },
});
