import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

const pub = () => createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } });

export const Route = createFileRoute("/api/public/analytics")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const days = Math.min(Number(url.searchParams.get("days") ?? 30), 365);
        const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
        const { data, error } = await pub().from("analytics_daily").select("*").gte("day", since).order("day", { ascending: true });
        if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
        return Response.json({ days, analytics: data });
      },
    },
  },
});
