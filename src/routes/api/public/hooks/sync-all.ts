import { createFileRoute } from "@tanstack/react-router";

// Public cron hook — pg_cron pings this every minute to pull the latest
// transactions from every enabled integration into OpenLedger.
export const Route = createFileRoute("/api/public/hooks/sync-all")({
  server: {
    handlers: {
      POST: async () => {
        const { runSyncAll } = await import("@/lib/integrations-sync.server");
        try {
          const results = await runSyncAll();
          return new Response(JSON.stringify({ ok: true, results }), {
            headers: { "content-type": "application/json" },
          });
        } catch (e: any) {
          return new Response(
            JSON.stringify({ ok: false, error: String(e?.message ?? e) }),
            { status: 500, headers: { "content-type": "application/json" } },
          );
        }
      },
      GET: async () => {
        const { runSyncAll } = await import("@/lib/integrations-sync.server");
        const results = await runSyncAll();
        return new Response(JSON.stringify({ ok: true, results }), {
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});
