import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

function pub() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

export const Route = createFileRoute("/api/public/transactions")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 200);
        const source = url.searchParams.get("source");
        const type = url.searchParams.get("type");
        const merchant_id = url.searchParams.get("merchant_id");
        let q = pub().from("ledger_transactions").select("*").order("ts", { ascending: false }).limit(limit);
        if (source) q = q.eq("source", source);
        if (type) q = q.eq("type", type);
        if (merchant_id) q = q.eq("merchant_id", merchant_id);
        const { data, error } = await q;
        if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
        return Response.json({ transactions: data });
      },
    },
  },
});
