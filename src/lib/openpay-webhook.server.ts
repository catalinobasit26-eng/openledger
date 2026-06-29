// HMAC verification for OpenPay webhooks
import { createHmac, timingSafeEqual } from "node:crypto";

export function verifyOpenPaySignature(rawBody: string, headerSig: string | null): boolean {
  const secret = process.env.OPENPAY_WEBHOOK_SECRET;
  if (!secret || !headerSig) return false;
  const sig = headerSig.startsWith("sha256=") ? headerSig.slice(7) : headerSig;
  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  try {
    const a = Buffer.from(sig, "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export async function logApi(opts: {
  endpoint: string; method: string; status: number; latency_ms?: number; error?: string; metadata?: any;
}) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("api_logs").insert({
      endpoint: opts.endpoint,
      method: opts.method,
      status: opts.status,
      latency_ms: opts.latency_ms ?? null,
      error: opts.error ?? null,
      metadata: opts.metadata ?? {},
    });
  } catch (e) {
    console.error("api_logs insert failed", e);
  }
}
