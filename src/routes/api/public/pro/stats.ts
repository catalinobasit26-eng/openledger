import { createFileRoute } from "@tanstack/react-router";

import { fetchProLedgerStats } from "@/lib/openpay-pro-ledger";

export const Route = createFileRoute("/api/public/pro/stats")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const data = await fetchProLedgerStats();
          return Response.json(data);
        } catch (e) {
          const message = e instanceof Error ? e.message : "Failed to fetch Pro ledger stats";
          const status = /not configured|api key/i.test(message) ? 503 : 502;
          return Response.json({ error: message }, { status });
        }
      },
    },
  },
});
