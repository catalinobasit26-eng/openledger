import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

const pub = () => createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } });

export const Route = createFileRoute("/api/public/wallet/$address")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const c = pub();
        const [wallet, incoming, outgoing] = await Promise.all([
          c.from("wallets").select("*").eq("address", params.address).maybeSingle(),
          c.from("ledger_transactions").select("*").eq("to_address", params.address).order("ts", { ascending: false }).limit(50),
          c.from("ledger_transactions").select("*").eq("from_address", params.address).order("ts", { ascending: false }).limit(50),
        ]);
        return Response.json({ wallet: wallet.data, incoming: incoming.data, outgoing: outgoing.data });
      },
    },
  },
});
