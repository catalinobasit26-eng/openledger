import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, ExternalLink } from "lucide-react";
import type { ReactNode } from "react";

import { TypeBadge } from "@/components/badges";
import { CopyButton } from "@/components/copy-button";
import { PageLoader } from "@/components/page-loader";
import {
  classifyOpenLedgerNote,
  decodeOpenLedgerOpKey,
  OPENLEDGER_TESTNET_API,
  type OpenLedgerEntry,
  type OpenLedgerParty,
} from "@/lib/openledger-api";
import { formatAmount, formatNumber, fullDate, shortHash, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/pi/op/$key")({
  head: ({ params }) => {
    const entry = decodeOpenLedgerOpKey(params.key);
    const titleAmt = entry ? `${formatNumber(entry.amount)} ${entry.currency}` : shortHash(params.key, 6, 4);
    return {
      meta: [
        { title: `Operation ${titleAmt} — OpenLedger` },
        { name: "description", content: "OpenPay testnet OpenLedger operation detail." },
      ],
    };
  },
  component: PiOpDetailPage,
});

type OpResponse = {
  entry: OpenLedgerEntry;
  chain_hash: string | null;
  error?: string;
};

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const body = (await res.json()) as T & { error?: string };
  if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
  return body;
}

function PiOpDetailPage() {
  const { key } = Route.useParams();
  const fallback = decodeOpenLedgerOpKey(key);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["pi-op", key],
    queryFn: () => getJson<OpResponse>(`/api/public/pi/operation/${encodeURIComponent(key)}`),
  });

  if (isLoading && !fallback) return <PageLoader label="Loading operation…" />;

  const entry = data?.entry ?? fallback;
  if (!entry || (isError && !fallback)) {
    return (
      <div className="space-y-4">
        <Link
          to="/pi/"
          search={{ tab: "operations", cursor: undefined, offset: 0 }}
          className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Operations
        </Link>
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          {error instanceof Error ? error.message : "Operation not found"}
        </div>
      </div>
    );
  }

  const kind = classifyOpenLedgerNote(entry.note);
  const chainHash = data?.chain_hash ?? null;
  const ok = ["completed", "success", "confirmed"].includes(entry.status.toLowerCase());

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/pi/"
          search={{ tab: "operations", cursor: undefined, offset: 0 }}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Operations
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="text-xs uppercase tracking-wider text-muted-foreground">OpenLedger Operation</span>
          <span className="rounded-md bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-600 dark:text-amber-400">
            Testnet
          </span>
          <TypeBadge type={kind} />
        </div>
        <h1 className="mt-1 text-2xl font-bold tracking-tight tabular-nums">
          {formatAmount(entry.amount, entry.currency || "OUSD")}
        </h1>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium capitalize",
              ok ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-muted text-muted-foreground",
            )}
          >
            <span className={cn("h-1.5 w-1.5 rounded-full", ok ? "bg-emerald-500" : "bg-muted-foreground")} />
            {entry.status || "unknown"}
          </span>
          <a
            href={`${OPENLEDGER_TESTNET_API}?limit=50`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            OpenLedger API <ExternalLink className="h-3 w-3" />
          </a>
          {chainHash ? (
            <Link
              to="/pi/tx/$hash"
              params={{ hash: chainHash }}
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              View chain tx <ExternalLink className="h-3 w-3" />
            </Link>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-xl border border-border bg-card p-5 space-y-4 text-sm">
          <div className="grid gap-4 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
            <PartyCard label="From" party={entry.sender} />
            <ArrowRight className="mx-auto h-4 w-4 text-muted-foreground" />
            <PartyCard label="To" party={entry.receiver} />
          </div>
          <Row label="Amount">
            <span className="text-lg font-semibold tabular-nums">
              {formatAmount(entry.amount, entry.currency || "OUSD")}
            </span>
          </Row>
          <Row label="Timestamp">
            <div>{fullDate(entry.occurred_at)}</div>
            <div className="text-xs text-muted-foreground">{timeAgo(entry.occurred_at)}</div>
          </Row>
          <Row label="Event type">
            <span className="font-mono text-xs">{entry.event_type}</span>
          </Row>
          {entry.note ? (
            <Row label="Note">
              <span className="break-words">{entry.note}</span>
            </Row>
          ) : null}
          {entry.sender_amount != null || entry.receiver_amount != null ? (
            <>
              {entry.sender_amount != null ? (
                <Row label="Sender amount">
                  {formatNumber(entry.sender_amount)} {entry.sender_currency || ""}
                </Row>
              ) : null}
              {entry.receiver_amount != null ? (
                <Row label="Receiver amount">
                  {formatNumber(entry.receiver_amount)} {entry.receiver_currency || ""}
                </Row>
              ) : null}
            </>
          ) : null}
        </div>

        <div className="rounded-xl border border-border bg-card p-5 space-y-4 text-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Links</div>
          {chainHash ? (
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Matched Pi Testnet payment</div>
              <Link
                to="/pi/tx/$hash"
                params={{ hash: chainHash }}
                className="block font-mono text-xs text-primary hover:underline break-all"
              >
                {chainHash}
              </Link>
              <CopyButton value={chainHash} />
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              No matching on-chain payment found for this OpenLedger entry yet. Top-ups often settle to the OpenPay
              Horizon account within a few minutes.
            </p>
          )}
          <div className="rounded-md border border-border p-3 text-xs text-muted-foreground">
            Application ledger event from the OpenPay testnet public feed. Chain settlement (when present) appears under
            Payments / Transactions.
          </div>
        </div>
      </div>
    </div>
  );
}

function PartyCard({ label, party }: { label: string; party: OpenLedgerParty }) {
  const initial = (party?.name || party?.username || "?").slice(0, 1).toUpperCase();
  return (
    <div className="rounded-lg border border-border/70 bg-muted/30 p-3 min-w-0">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-2 flex items-center gap-2 min-w-0">
        {party?.avatar_url ? (
          <img
            src={party.avatar_url}
            alt=""
            className="h-9 w-9 shrink-0 rounded-full object-cover bg-muted"
            loading="lazy"
          />
        ) : (
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
            {initial}
          </div>
        )}
        <div className="min-w-0">
          <div className="truncate font-medium">{party?.name || "—"}</div>
          <div className="truncate text-xs text-muted-foreground">@{party?.username || "unknown"}</div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-3 border-b border-border pb-3 last:border-0 last:pb-0">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="col-span-2 min-w-0">{children}</div>
    </div>
  );
}
