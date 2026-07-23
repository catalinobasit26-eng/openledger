import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

const pub = () =>
  createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });

function parseDataUrl(value: string): { mime: string; bytes: Uint8Array } | null {
  const m = value.match(/^data:([^;,]+)?(?:;charset=[^;,]+)?;base64,([\s\S]+)$/i);
  if (m) {
    const mime = m[1] || "image/jpeg";
    const bin = Buffer.from(m[2], "base64");
    return { mime, bytes: Uint8Array.from(bin) };
  }
  if (/^\/9j\//.test(value)) {
    return { mime: "image/jpeg", bytes: Uint8Array.from(Buffer.from(value, "base64")) };
  }
  if (/^iVBOR/.test(value)) {
    return { mime: "image/png", bytes: Uint8Array.from(Buffer.from(value, "base64")) };
  }
  return null;
}

async function resolveCoverDataUrl(slug: string): Promise<string | null> {
  const client = pub();
  const key = slug.toLowerCase();

  try {
    const { data } = await client.rpc("get_nft_collection_cover" as any, { _slug: key });
    if (typeof data === "string" && data.length > 0) return data;
  } catch {
    /* rpc may be missing */
  }

  const { data: coll } = await client
    .from("nft_collections")
    .select("id, image_url")
    .eq("slug", key)
    .maybeSingle();
  if (typeof coll?.image_url === "string" && coll.image_url.length > 0) return coll.image_url;

  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("ledger_transactions")
      .select("metadata")
      .in("type", ["nft_mint", "nft_sale"])
      .filter("metadata->item->>collection_id", "ilike", key)
      .order("ts", { ascending: false })
      .limit(1);
    const raw =
      (rows?.[0] as any)?.metadata?.item?.image_url ??
      (rows?.[0] as any)?.metadata?.item?.cover_url;
    if (typeof raw === "string" && raw.length > 0) {
      if (coll?.id) {
        await supabaseAdmin.from("nft_collections").update({ image_url: raw }).eq("id", coll.id);
      }
      return raw;
    }
  } catch {
    /* no service role / timeout */
  }

  return null;
}

export const Route = createFileRoute("/api/public/nft/$slug/cover")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const slug = String(params.slug ?? "").toLowerCase();
        if (!slug) return new Response("Missing slug", { status: 400 });

        const accept = request.headers.get("accept") ?? "";
        const wantsJson = accept.includes("application/json") && !accept.includes("image/");

        const raw = await resolveCoverDataUrl(slug);
        if (!raw) {
          return wantsJson
            ? Response.json({ image_url: null }, { status: 404 })
            : new Response(null, { status: 404 });
        }

        // Remote http(s) cover — redirect so the browser loads it directly.
        if (/^https?:\/\//i.test(raw)) {
          if (wantsJson) return Response.json({ image_url: raw });
          return Response.redirect(raw, 302);
        }

        const parsed = parseDataUrl(raw);
        if (!parsed) {
          return wantsJson
            ? Response.json({ image_url: raw })
            : new Response("Unsupported image payload", { status: 415 });
        }

        if (wantsJson) {
          // Keep JSON tiny — clients should use the binary image route, not embed base64.
          return Response.json({
            image_url: `/api/public/nft/${encodeURIComponent(slug)}/cover`,
            mime: parsed.mime,
            bytes: parsed.bytes.byteLength,
          });
        }

        return new Response(parsed.bytes, {
          status: 200,
          headers: {
            "Content-Type": parsed.mime,
            "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
            "Content-Length": String(parsed.bytes.byteLength),
          },
        });
      },
    },
  },
});
