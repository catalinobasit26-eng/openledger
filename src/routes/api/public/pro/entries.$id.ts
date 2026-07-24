import { createFileRoute } from "@tanstack/react-router";

import { fetchProLedgerEntry } from "@/lib/openpay-pro-ledger";

export const Route = createFileRoute("/api/public/pro/entries/$id")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        try {
          const entry = await fetchProLedgerEntry(params.id);
          return Response.json({ entry });
        } catch (e) {
          const message = e instanceof Error ? e.message : "Failed to fetch Pro ledger entry";
          const status = /not found|404/i.test(message)
            ? 404
            : /not configured|api key/i.test(message)
              ? 503
              : 502;
          return Response.json({ error: message }, { status });
        }
      },
    },
  },
});
