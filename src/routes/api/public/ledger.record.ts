import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { verifyOpenPaySignature, logApi } from "@/lib/openpay-webhook.server";

const txSchema = z.object({
  source: z.enum(["openpay", "openpay_pro"]),
  type: z.enum(["payment", "transfer", "swap", "nft_mint", "nft_sale", "merchant_payment", "withdrawal", "deposit", "refund"]),
  from_address: z.string().min(2).max(128).nullable().optional(),
  to_address: z.string().min(2).max(128).nullable().optional(),
  amount: z.union([z.number(), z.string()]).transform((v) => Number(v)),
  currency: z.string().min(1).max(16),
  network_fee: z.union([z.number(), z.string()]).optional().transform((v) => (v == null ? 0 : Number(v))),
  status: z.enum(["pending", "confirmed", "failed", "reversed"]).default("confirmed"),
  merchant_id: z.string().max(128).nullable().optional(),
  external_ref: z.string().max(256).nullable().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
  timestamp: z.string().datetime().optional(),
});

export const Route = createFileRoute("/api/public/ledger/record")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const started = Date.now();
        const raw = await request.text();
        const sig = request.headers.get("x-openpay-signature");
        if (!verifyOpenPaySignature(raw, sig)) {
          await logApi({ endpoint: "/api/public/ledger/record", method: "POST", status: 401, error: "bad signature", latency_ms: Date.now() - started });
          return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 401, headers: { "content-type": "application/json" } });
        }
        let body: unknown;
        try { body = JSON.parse(raw); } catch {
          return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400 });
        }
        const parsed = txSchema.safeParse(body);
        if (!parsed.success) {
          await logApi({ endpoint: "/api/public/ledger/record", method: "POST", status: 400, error: parsed.error.message, latency_ms: Date.now() - started });
          return new Response(JSON.stringify({ error: "Validation", issues: parsed.error.issues }), { status: 400, headers: { "content-type": "application/json" } });
        }
        const d = parsed.data;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin.rpc("record_transaction" as any, {
          p_source: d.source,
          p_type: d.type,
          p_from: d.from_address ?? undefined,
          p_to: d.to_address ?? undefined,
          p_amount: d.amount,
          p_currency: d.currency,
          p_fee: d.network_fee ?? 0,
          p_status: d.status,
          p_merchant_id: d.merchant_id ?? undefined,
          p_external_ref: d.external_ref ?? undefined,
          p_metadata: d.metadata ?? {},
          p_ts: d.timestamp ?? new Date().toISOString(),
        });
        if (error) {
          await logApi({ endpoint: "/api/public/ledger/record", method: "POST", status: 500, error: error.message, latency_ms: Date.now() - started });
          return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { "content-type": "application/json" } });
        }
        await logApi({ endpoint: "/api/public/ledger/record", method: "POST", status: 200, latency_ms: Date.now() - started });
        return Response.json({ ok: true, transaction: data });
      },
      GET: async () => new Response("Method not allowed", { status: 405 }),
    },
  },
});
