import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, ShieldCheck } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { CopyButton } from "@/components/copy-button";
import { StatusBadge, SourceBadge, TypeBadge, VerifyBadge } from "@/components/badges";
import { formatAmount, formatNumber, fullDate, shortHash, timeAgo } from "@/lib/format";

export const Route = createFileRoute("/tx/$hash")({
  head: ({ params }) => ({
    meta: [
      { title: `Transaction ${shortHash(params.hash, 6, 4)} — OpenLedger` },
      { name: "description", content: "Transaction detail on the OpenPay public ledger." },
    ],
  }),
  component: TxDetailPage,
  errorComponent: ({ error }) => <div className="text-sm text-destructive">{error.message}</div>,
  notFoundComponent: () => <div className="text-sm text-muted-foreground">Transaction not found.</div>,
});

function TxDetailPage() {
  const { hash } = Route.useParams();

  const { data: tx, isLoading } = useQuery({
    queryKey: ["tx", hash],
    queryFn: async () => {
      const { data, error } = await supabase.from("ledger_transactions").select("*").eq("hash", hash).maybeSingle();
      if (error) throw error;
      if (!data) throw notFound();
      return data;
    },
  });

  const { data: nextBlock } = useQuery({
    enabled: !!tx,
    queryKey: ["next-block", tx?.block_number],
    queryFn: async () => {
      const { data } = await supabase
        .from("ledger_transactions")
        .select("hash,block_number")
        .gt("block_number", tx!.block_number)
        .order("block_number", { ascending: true })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  if (isLoading) return <div className="text-sm text-muted-foreground">Loading…</div>;
  if (!tx) return <div className="text-sm text-muted-foreground">Transaction not found.</div>;

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs uppercase tracking-wider text-muted-foreground">Transaction</div>
        <h1 className="mt-1 break-all font-mono text-lg sm:text-xl">{tx.hash}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <StatusBadge status={tx.status} />
          <SourceBadge source={tx.source} />
          <TypeBadge type={tx.type} />
          <VerifyBadge verified={tx.verified} />
          <CopyButton value={tx.hash} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-xl border border-border bg-card p-5 space-y-3 text-sm">
          <Row label="Block">
            <span className="font-mono">#{tx.block_number}</span>
            {nextBlock && (
              <Link to="/tx/$hash" params={{ hash: nextBlock.hash }} className="ml-3 text-xs text-primary hover:underline">
                Next block →
              </Link>
            )}
          </Row>
          <Row label="Timestamp">
            <div>{fullDate(tx.ts)}</div>
            <div className="text-xs text-muted-foreground">{timeAgo(tx.ts)}</div>
          </Row>
          <Row label="From">
            {tx.from_address ? (
              <Link to="/wallet/$address" params={{ address: tx.from_address }} className="font-mono text-xs text-primary hover:underline break-all">
                {tx.from_address}
              </Link>
            ) : "—"}
          </Row>
          <div className="flex justify-center"><ArrowRight className="h-4 w-4 text-muted-foreground" /></div>
          <Row label="To">
            {tx.to_address ? (
              <Link to="/wallet/$address" params={{ address: tx.to_address }} className="font-mono text-xs text-primary hover:underline break-all">
                {tx.to_address}
              </Link>
            ) : "—"}
          </Row>
          <Row label="Amount"><span className="text-lg font-semibold">{formatAmount(tx.amount, tx.currency)}</span></Row>
          <Row label="Network Fee">{formatAmount(tx.network_fee, tx.currency)}</Row>
          {tx.merchant_id && (
            <Row label="Merchant">
              <Link to="/merchants/$id" params={{ id: tx.merchant_id }} className="text-primary hover:underline">{tx.merchant_id}</Link>
            </Row>
          )}
          {tx.external_ref && <Row label="External Ref"><span className="font-mono text-xs">{tx.external_ref}</span></Row>}
        </div>

        <div className="rounded-xl border border-border bg-card p-5 space-y-4 text-sm">
          <div className="flex items-center gap-2 text-success">
            <ShieldCheck className="h-4 w-4" />
            <span className="font-medium">Verified on hash chain</span>
          </div>
          <div className="space-y-1">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Previous hash</div>
            <div className="font-mono text-[10px] break-all rounded-md bg-muted p-2">{tx.previous_hash}</div>
          </div>
          <div className="space-y-1">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">This hash</div>
            <div className="font-mono text-[10px] break-all rounded-md bg-primary/10 text-primary p-2">{tx.hash}</div>
          </div>
          <div className="rounded-md border border-border p-3 text-xs text-muted-foreground">
            Every entry on the OpenLedger is sealed with SHA-256, chained to its predecessor, and immutable.
          </div>
        </div>
      </div>

      {tx.metadata && Object.keys(tx.metadata as object).length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Metadata</div>
            <div className="text-[10px] text-muted-foreground">Enriched fields from source event</div>
          </div>
          <MetadataGrid data={tx.metadata as Record<string, unknown>} />
          <details className="mt-4 group">
            <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground select-none">View raw JSON</summary>
            <pre className="mt-2 overflow-x-auto rounded-md bg-muted p-3 text-[11px]">{JSON.stringify(tx.metadata, null, 2)}</pre>
          </details>
        </div>
      )}
    </div>
  );
}

function MetadataGrid({ data }: { data: Record<string, unknown> }) {
  const entries = Object.entries(data).filter(([, v]) => v !== null && v !== undefined && v !== "");
  if (!entries.length) return null;
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {entries.map(([k, v]) => (
        <div key={k} className="rounded-lg border border-border/70 bg-muted/30 p-3 min-w-0">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{k.replace(/_/g, " ")}</div>
          <div className="mt-1 text-sm break-all min-w-0">
            <MetaValue value={v} />
          </div>
        </div>
      ))}
    </div>
  );
}

function MetaValue({ value }: { value: unknown }) {
  if (value === null || value === undefined) return <span className="text-muted-foreground">—</span>;
  if (typeof value === "boolean") {
    return <span className={value ? "text-success font-medium" : "text-muted-foreground"}>{value ? "Yes" : "No"}</span>;
  }
  if (typeof value === "number") return <span className="font-mono tabular-nums">{formatNumber(value)}</span>;
  if (typeof value === "string") {
    if (/^https?:\/\//i.test(value)) {
      return <a href={value} target="_blank" rel="noreferrer" className="text-primary hover:underline break-all">{value}</a>;
    }
    if (/^\d{4}-\d{2}-\d{2}T/.test(value)) {
      return <span className="text-sm">{fullDate(value)}</span>;
    }
    return <span>{value}</span>;
  }
  if (Array.isArray(value)) {
    return (
      <div className="flex flex-wrap gap-1">
        {value.slice(0, 20).map((item, i) => (
          <span key={i} className="inline-block rounded-md bg-background px-2 py-0.5 text-xs font-mono border border-border">
            {typeof item === "object" ? JSON.stringify(item) : String(item)}
          </span>
        ))}
      </div>
    );
  }
  if (typeof value === "object") {
    return (
      <div className="space-y-1">
        {Object.entries(value as Record<string, unknown>).map(([k, v]) => (
          <div key={k} className="flex gap-2 text-xs">
            <span className="text-muted-foreground shrink-0">{k}:</span>
            <span className="break-all"><MetaValue value={v} /></span>
          </div>
        ))}
      </div>
    );
  }
  return <span>{String(value)}</span>;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-3 border-b border-border pb-3 last:border-0 last:pb-0">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="col-span-2 min-w-0">{children}</div>
    </div>
  );
}
