import { createFileRoute } from "@tanstack/react-router";

import { fetchPiPayments, OPENPAY_TESTNET_ACCOUNT } from "@/lib/pi-horizon";

export const Route = createFileRoute("/api/public/pi/payments")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const account = url.searchParams.get("account") || OPENPAY_TESTNET_ACCOUNT;
        const cursor = url.searchParams.get("cursor") || undefined;
        const limit = Number(url.searchParams.get("limit") || 25);
        const order = (url.searchParams.get("order") as "asc" | "desc") || "desc";
        try {
          const data = await fetchPiPayments(account, {
            cursor,
            limit: Math.min(100, Math.max(1, limit)),
            order,
          });
          return Response.json(data);
        } catch (e) {
          return Response.json(
            { error: e instanceof Error ? e.message : "Failed to fetch Pi payments" },
            { status: 502 },
          );
        }
      },
    },
  },
});
