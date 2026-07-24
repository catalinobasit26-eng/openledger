import { createFileRoute } from "@tanstack/react-router";

import { fetchPiAccount, OPENPAY_TESTNET_ACCOUNT } from "@/lib/pi-horizon";

export const Route = createFileRoute("/api/public/pi/account")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const account = url.searchParams.get("account") || OPENPAY_TESTNET_ACCOUNT;
        try {
          const data = await fetchPiAccount(account);
          return Response.json(data);
        } catch (e) {
          return Response.json(
            { error: e instanceof Error ? e.message : "Failed to fetch Pi account" },
            { status: 502 },
          );
        }
      },
    },
  },
});
