import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, RefreshCw, Save, Eye, EyeOff, Copy, Check } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { getIngestionConfig, syncIntegration } from "@/lib/integrations.functions";
import { timeAgo } from "@/lib/format";

type Integration = {
  id: string;
  slug: string;
  display_name: string;
  base_url: string | null;
  api_key: string | null;
  enabled: boolean;
  last_sync_at: string | null;
  last_sync_status: string | null;
  last_sync_error: string | null;
  last_sync_count: number;
};

function CopyBtn({ value }: { value: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(value);
        setDone(true);
        setTimeout(() => setDone(false), 1200);
      }}
      className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-[11px] hover:bg-muted"
    >
      {done ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
      {done ? "Copied" : "Copy"}
    </button>
  );
}

function IntegrationCard({ integ }: { integ: Integration }) {
  const qc = useQueryClient();
  const [baseUrl, setBaseUrl] = useState(integ.base_url ?? "");
  const [apiKey, setApiKey] = useState(integ.api_key ?? "");
  const [enabled, setEnabled] = useState(integ.enabled);
  const [showKey, setShowKey] = useState(false);
  const syncFn = useServerFn(syncIntegration);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("integrations")
        .update({ base_url: baseUrl, api_key: apiKey, enabled })
        .eq("id", integ.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success(`${integ.display_name} saved`);
      qc.invalidateQueries({ queryKey: ["integrations"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const sync = useMutation({
    mutationFn: async () => syncFn({ data: { slug: integ.slug } }),
    onSuccess: (r: any) => {
      toast.success(`${integ.display_name}: imported ${r.ok}/${r.total} (${r.failed} failed)`);
      qc.invalidateQueries({ queryKey: ["integrations"] });
      qc.invalidateQueries({ queryKey: ["admin-recent-tx"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">{integ.display_name}</h3>
          <p className="text-[11px] text-muted-foreground">slug: <code>{integ.slug}</code></p>
        </div>
        <div className="flex items-center gap-2 text-[11px]">
          {integ.last_sync_at ? (
            <span className={
              integ.last_sync_status === "ok" ? "text-success" :
              integ.last_sync_status === "partial" ? "text-warning" : "text-destructive"
            }>
              {integ.last_sync_status ?? "—"} · synced {timeAgo(integ.last_sync_at)} · {integ.last_sync_count} tx
            </span>
          ) : (
            <span className="text-muted-foreground">Never synced</span>
          )}
        </div>
      </div>

      <div className="mt-4 grid gap-3">
        <label className="text-xs">
          <span className="text-muted-foreground">Base URL</span>
          <input
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="https://example.com"
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </label>
        <label className="text-xs">
          <span className="text-muted-foreground">API Key</span>
          <div className="mt-1 flex gap-2">
            <input
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              type={showKey ? "text" : "password"}
              placeholder="sk_live_..."
              className="w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-sm"
            />
            <button
              type="button"
              onClick={() => setShowKey((s) => !s)}
              className="rounded-md border border-border bg-background px-2 hover:bg-muted"
              aria-label={showKey ? "Hide" : "Show"}
            >
              {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </label>
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          <span>Enabled</span>
        </label>
        {integ.last_sync_error && (
          <p className="text-[11px] text-destructive">Last error: {integ.last_sync_error}</p>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          onClick={() => save.mutate()}
          disabled={save.isPending}
          className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {save.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
          Save
        </button>
        <button
          onClick={() => sync.mutate()}
          disabled={sync.isPending || !baseUrl || !apiKey}
          className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50"
        >
          {sync.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
          Sync now
        </button>
      </div>
    </div>
  );
}

export function IntegrationsPanel({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const [revealSecret, setRevealSecret] = useState(false);

  const integrations = useQuery({
    enabled: isSuperAdmin,
    queryKey: ["integrations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("integrations").select("*").order("display_name");
      if (error) throw new Error(error.message);
      return (data ?? []) as Integration[];
    },
  });

  const cfgFn = useServerFn(getIngestionConfig);
  const cfg = useQuery({
    enabled: isSuperAdmin,
    queryKey: ["ingestion-config"],
    queryFn: () => cfgFn(),
  });

  if (!isSuperAdmin) {
    return (
      <div className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">
        Integrations and ingestion configuration are only visible to super admins.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section>
        <h2 className="mb-3 text-sm font-semibold">Source integrations</h2>
        <p className="mb-4 text-xs text-muted-foreground">
          Enter each upstream app's base URL and API key once. OpenLedger will pull transactions from
          <code className="mx-1">{`{base_url}/api/transactions`}</code> using a bearer token, and also accept signed
          webhooks from the same source.
        </p>
        <div className="grid gap-4 lg:grid-cols-2">
          {integrations.data?.map((i) => <IntegrationCard key={i.id} integ={i} />)}
          {integrations.isLoading && (
            <div className="text-xs text-muted-foreground">Loading integrations…</div>
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold">OpenLedger ingestion API</h2>
        <p className="mb-4 text-xs text-muted-foreground">
          Share these URLs with the OpenPay / OpenPay Pro backends so they can push signed transactions to OpenLedger in real time.
        </p>
        <div className="rounded-xl border border-border bg-card p-5">
          {cfg.isLoading && <p className="text-xs text-muted-foreground">Loading…</p>}
          {cfg.data && (
            <div className="space-y-4 text-xs">
              <div>
                <div className="mb-1 text-[11px] uppercase tracking-wider text-muted-foreground">Webhook (push) endpoints</div>
                <ul className="space-y-2 font-mono">
                  <li className="flex items-center justify-between gap-2">
                    <span><span className="text-primary">POST</span> {cfg.data.endpoints.record}</span>
                    <CopyBtn value={cfg.data.endpoints.record} />
                  </li>
                  <li className="flex items-center justify-between gap-2">
                    <span><span className="text-primary">POST</span> {cfg.data.endpoints.bulk}</span>
                    <CopyBtn value={cfg.data.endpoints.bulk} />
                  </li>
                </ul>
              </div>
              <div>
                <div className="mb-1 text-[11px] uppercase tracking-wider text-muted-foreground">Public read endpoints</div>
                <ul className="space-y-1 font-mono">
                  <li>GET {cfg.data.endpoints.transactions}</li>
                  <li>GET {cfg.data.endpoints.transaction}</li>
                  <li>GET {cfg.data.endpoints.wallet}</li>
                  <li>GET {cfg.data.endpoints.merchant}</li>
                  <li>GET {cfg.data.endpoints.token}</li>
                  <li>GET {cfg.data.endpoints.nft}</li>
                  <li>GET {cfg.data.endpoints.analytics}</li>
                </ul>
              </div>
              <div>
                <div className="mb-1 text-[11px] uppercase tracking-wider text-muted-foreground">Signature</div>
                <p>Header <code>{cfg.data.signature_header}</code> · format <code>{cfg.data.signature_format}</code></p>
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Webhook secret</span>
                  <div className="flex gap-2">
                    <button onClick={() => setRevealSecret((s) => !s)} className="rounded-md border border-border bg-background px-2 py-1 text-[11px] hover:bg-muted">
                      {revealSecret ? "Hide" : "Reveal"}
                    </button>
                    {revealSecret && <CopyBtn value={cfg.data.webhook_secret} />}
                  </div>
                </div>
                <code className="block break-all rounded-md bg-muted px-3 py-2 font-mono">
                  {revealSecret ? (cfg.data.webhook_secret || "(not set)") : "•".repeat(40)}
                </code>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
