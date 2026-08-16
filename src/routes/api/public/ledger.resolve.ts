import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

function pub() {
  return createClient(process.env['SUPABASE_URL']!, process.env['SUPABASE_PUBLISHABLE_KEY']!, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Resolve an OpenPay-side identifier (external_ref) or an OpenLedger hash into
 * the canonical OpenLedger transaction + permalink.
 *
 * GET /api/public/ledger/resolve?ref=<external_ref>
 * GET /api/public/ledger/resolve?hash=<ledger_hash>
 * Optional: &redirect=1 -> 302 to the human-readable /tx/<hash> page
 */
export const Route = createFileRoute("/api/public/ledger/resolve")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const ref = url.searchParams.get("ref");
        const hash = url.searchParams.get("hash");
        const wantRedirect = url.searchParams.get("redirect") === "1";
        if (!ref && !hash) {
          return Response.json({ error: "Provide ?ref= or ?hash=" }, { status: 400 });
        }

        const client = pub();
        let data: any = null;
        if (hash) {
          const r = await client.from("ledger_transactions").select("*").eq("hash", hash).limit(1).maybeSingle();
          if (r.error) return Response.json({ error: r.error.message }, { status: 500 });
          data = r.data;
        } else {
          const safe = ref!.replace(/[,()*]/g, "");
          const r = await client.from("ledger_transactions").select("*").eq("external_ref", safe).limit(1).maybeSingle();
          if (r.error) return Response.json({ error: r.error.message }, { status: 500 });
          data = r.data;
          if (!data) {
            const alt = await client
              .from("ledger_transactions")
              .select("*")
              .or(
                [
                  `hash.eq.${safe}`,
                  `metadata->>openpay_ledger_event_id.eq.${safe}`,
                  `metadata->>tx_id.eq.${safe}`,
                  `metadata->>tx_hash.eq.${safe}`,
                  `metadata->>note.ilike.*${safe}*`,
                ].join(","),
              )
              .limit(1)
              .maybeSingle();
            if (alt.error) return Response.json({ error: alt.error.message }, { status: 500 });
            data = alt.data;
          }
        }

        if (!data) return Response.json({ found: false, error: "Not found" }, { status: 404 });


        const permalink = `${url.origin}/tx/${data.hash}`;
        if (wantRedirect) {
          return new Response(null, { status: 302, headers: { location: `/tx/${data.hash}` } });
        }
        return Response.json({ found: true, permalink, transaction: data });
      },
    },
  },
});
