import { createFileRoute } from "@tanstack/react-router";

import { decodeOpenLedgerOpKey, findOpenLedgerEntry } from "@/lib/openledger-api";
import { fetchPiPayments, OPENPAY_TESTNET_ACCOUNT } from "@/lib/pi-horizon";

export const Route = createFileRoute("/api/public/pi/operation/$key")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const decoded = decodeOpenLedgerOpKey(params.key);
        if (!decoded) {
          return Response.json({ error: "Invalid operation key" }, { status: 400 });
        }

        let entry = decoded;
        try {
          const fresh = await findOpenLedgerEntry(decoded);
          if (fresh) entry = fresh;
        } catch {
          // Fall back to decoded payload from the URL.
        }

        let chainHash: string | null = null;
        try {
          const payments = await fetchPiPayments(OPENPAY_TESTNET_ACCOUNT, { limit: 100, order: "desc" });
          const occurred = new Date(entry.occurred_at).getTime();
          const amount = Number(entry.amount);
          const match = (payments._embedded?.records ?? []).find((p) => {
            const delta = Math.abs(new Date(p.created_at).getTime() - occurred);
            return delta <= 5 * 60_000 && Math.abs(Number(p.amount) - amount) < 0.0000001;
          });
          chainHash = match?.transaction_hash ?? null;
        } catch {
          // Chain match is optional.
        }

        return Response.json({ entry, chain_hash: chainHash });
      },
    },
  },
});
