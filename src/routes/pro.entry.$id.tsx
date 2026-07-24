import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ExternalLink } from "lucide-react";
import type { ReactNode } from "react";

import { CopyButton } from "@/components/copy-button";
import { PageLoader } from "@/components/page-loader";
import { StatusBadge, TypeBadge } from "@/components/badges";
import {
  OPENPAY_PRO_APP_URL,
  type ProLedgerEntry,
} from "@/lib/openpay-pro-ledger";
import { formatAmount, formatUsd, fullDate, shortHash, timeAgo } from "@/lib/format";

export const Route = createFileRoute("/pro/entry/$id")({
  head: ({ params }) => ({
    meta: [
      { title: `Pro ledger ${shortHash(params.id, 8, 4)} — OpenLedger` },
      { name: "description", content: "OpenPay Pro public ledger entry detail." },
    ],
  }),
  component: ProEntryDetailPage,
});

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const body = (await res.json()) as T & { error?: string };
  if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
  return body;
}

function ProEntryDetailPage() {
  const { id } = Route.useParams();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["pro-ledger-entry", id],
    queryFn: () => getJson<{ entry: ProLedgerEntry }>(`/api/public/pro/entries/${encodeURIComponent(id)}`),
  });

  if (isLoading) return <PageLoader label="Loading ledger entry…" />;

  if (isError || !data?.entry) {
    return (
      <div className="space-y-4">
        <Link to="/pro" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Pro Ledger
        </Link>
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          {error instanceof Error ? error.message : "Entry not found"}
        </div>
      </div>
    );
  }

  const e = data.entry;

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/pro"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Pro Ledger
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="text-xs uppercase tracking-wider text-muted-foreground">Ledger entry</span>
          <span className="rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
            OpenPay Pro
          </span>
          <TypeBadge type={e.type} />
          <StatusBadge status={e.status} />
        </div>
        <h1 className="mt-1 text-2xl font-bold tracking-tight tabular-nums">
          {formatAmount(e.amount, e.asset || "OUSD")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Sequence #{e.sequence} · {timeAgo(e.occurred_at)}
        </p>
        <div className="mt-3 flex flex-wrap gap-3 text-xs">
          <a
            href={OPENPAY_PRO_APP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-primary hover:underline"
          >
            OpenPay Pro <ExternalLink className="h-3 w-3" />
          </a>
          {e.tx_hash ? (
            <Link
              to="/tx/$hash"
              params={{ hash: e.tx_hash }}
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              OpenLedger tx <ExternalLink className="h-3 w-3" />
            </Link>
          ) : null}
        </div>
      </div>

      <dl className="grid gap-3 sm:grid-cols-2">
        <Field label="Entry ID" mono copy={e.id}>
          {e.id}
        </Field>
        <Field label="Sequence" mono>
          {e.sequence}
        </Field>
        <Field label="From" mono copy={e.from_address ?? undefined}>
          {e.from_address || "—"}
        </Field>
        <Field label="To" mono copy={e.to_address ?? undefined}>
          {e.to_address || "—"}
        </Field>
        <Field label="Asset">{e.asset || "—"}</Field>
        <Field label="USD value">{e.usd_value != null && e.usd_value !== "" ? formatUsd(e.usd_value) : "—"}</Field>
        <Field label="Type" className="capitalize">
          {e.type}
        </Field>
        <Field label="Status" className="capitalize">
          {e.status}
        </Field>
        <Field label="Occurred at">{fullDate(e.occurred_at)}</Field>
        <Field label="Tx ID" mono copy={e.tx_id ?? undefined}>
          {e.tx_id || "—"}
        </Field>
        <Field label="Tx hash" mono copy={e.tx_hash ?? undefined}>
          {e.tx_hash || "—"}
        </Field>
        <Field label="Memo">{e.memo || "—"}</Field>
      </dl>
    </div>
  );
}

function Field({
  label,
  children,
  mono,
  copy,
  className,
}: {
  label: string;
  children: ReactNode;
  mono?: boolean;
  copy?: string;
  className?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card/50 p-3">
      <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className={`mt-1 break-all text-sm ${mono ? "font-mono text-xs sm:text-sm" : ""} ${className ?? ""}`}>
        <span className="inline-flex max-w-full items-start gap-2">
          <span className="min-w-0">{children}</span>
          {copy ? <CopyButton value={copy} /> : null}
        </span>
      </dd>
    </div>
  );
}
