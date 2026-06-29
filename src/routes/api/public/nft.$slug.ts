import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

const pub = () => createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } });

export const Route = createFileRoute("/api/public/nft/$slug")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const c = pub();
        const { data: coll } = await c.from("nft_collections").select("*").eq("slug", params.slug).maybeSingle();
        if (!coll) return new Response(JSON.stringify({ error: "Not found" }), { status: 404 });
        const { data: events } = await c.from("nft_transactions").select("*").eq("collection_id", coll.id).order("ts", { ascending: false }).limit(50);
        return Response.json({ collection: coll, events });
      },
    },
  },
});
