import { createFileRoute } from "@tanstack/react-router";

import { fetchPiTransaction, fetchPiTransactionOperations } from "@/lib/pi-horizon";

export const Route = createFileRoute("/api/public/pi/transaction/$hash")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        try {
          const [tx, ops] = await Promise.all([
            fetchPiTransaction(params.hash),
            fetchPiTransactionOperations(params.hash),
          ]);
          return Response.json({ transaction: tx, operations: ops._embedded?.records ?? [] });
        } catch (e) {
          return Response.json(
            { error: e instanceof Error ? e.message : "Failed to fetch Pi transaction" },
            { status: 502 },
          );
        }
      },
    },
  },
});
