import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

const pub = () => createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } });

export const Route = createFileRoute("/api/public/token/$symbol")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const c = pub();
        const [token, transfers] = await Promise.all([
          c.from("tokens").select("*").eq("symbol", params.symbol).maybeSingle(),
          c.from("ledger_transactions").select("*").eq("currency", params.symbol).order("ts", { ascending: false }).limit(50),
        ]);
        if (!token.data) return new Response(JSON.stringify({ error: "Not found" }), { status: 404 });
        return Response.json({ token: token.data, transfers: transfers.data });
      },
    },
  },
});
