import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

const pub = () => createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } });

export const Route = createFileRoute("/api/public/merchant/$id")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const c = pub();
        const [merchant, tx] = await Promise.all([
          c.from("merchants").select("*").eq("id", params.id).maybeSingle(),
          c.from("ledger_transactions").select("*").eq("merchant_id", params.id).order("ts", { ascending: false }).limit(50),
        ]);
        if (!merchant.data) return new Response(JSON.stringify({ error: "Not found" }), { status: 404 });
        return Response.json({ merchant: merchant.data, transactions: tx.data });
      },
    },
  },
});
