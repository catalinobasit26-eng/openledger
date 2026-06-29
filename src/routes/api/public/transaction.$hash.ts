import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

const pub = () => createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } });

export const Route = createFileRoute("/api/public/transaction/$hash")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const { data, error } = await pub().from("ledger_transactions").select("*").eq("hash", params.hash).maybeSingle();
        if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
        if (!data) return new Response(JSON.stringify({ error: "Not found" }), { status: 404 });
        return Response.json({ transaction: data });
      },
    },
  },
});
