import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { fetchProLedgerEntries } from "@/lib/openpay-pro-ledger";

const typeSchema = z
  .enum(["send", "receive", "buy", "sell", "swap", "mint"])
  .optional()
  .catch(undefined);

export const Route = createFileRoute("/api/public/pro/entries")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const limit = Math.min(500, Math.max(1, Number(url.searchParams.get("limit") || 50)));
        const cursor = url.searchParams.get("cursor") || undefined;
        const asset = url.searchParams.get("asset") || undefined;
        const address = url.searchParams.get("address") || undefined;
        const since = url.searchParams.get("since") || undefined;
        const typeRaw = url.searchParams.get("type");
        const type = typeRaw ? typeSchema.parse(typeRaw) : undefined;

        try {
          const data = await fetchProLedgerEntries({ limit, cursor, asset, type, address, since });
          return Response.json(data);
        } catch (e) {
          const message = e instanceof Error ? e.message : "Failed to fetch Pro ledger entries";
          const status = /not configured|api key/i.test(message) ? 503 : 502;
          return Response.json({ error: message }, { status });
        }
      },
    },
  },
});
