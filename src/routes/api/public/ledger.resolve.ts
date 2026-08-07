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
        let q = client.from("ledger_transactions").select("*").limit(1);
        q = hash ? q.eq("hash", hash) : q.eq("external_ref", ref!);
        const { data, error } = await q.maybeSingle();

        if (error) return Response.json({ error: error.message }, { status: 500 });
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
