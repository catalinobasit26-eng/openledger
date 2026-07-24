import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, ExternalLink } from "lucide-react";
import type { ReactNode } from "react";

import { CopyButton } from "@/components/copy-button";
import { PageLoader } from "@/components/page-loader";
import {
  assetLabel,
  feeInPi,
  OPENPAY_TESTNET_ACCOUNT,
  PI_TESTNET_HORIZON,
  type PiPayment,
  type PiTransaction,
} from "@/lib/pi-horizon";
import { formatInt, formatNumber, fullDate, shortHash, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/pi/tx/$hash")({
  head: ({ params }) => ({
    meta: [
      { title: `Pi Tx ${shortHash(params.hash, 6, 4)} — OpenLedger` },
      { name: "description", content: "Pi Network Testnet transaction detail for OpenPay OUSD explorer." },
    ],
  }),
  component: PiTxDetailPage,
});

type PiTxResponse = {
  transaction: PiTransaction;
  operations: (PiPayment & { type?: string })[];
  error?: string;
};

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const body = (await res.json()) as T & { error?: string };
  if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
  return body;
}

function PiTxDetailPage() {
  const { hash } = Route.useParams();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["pi-tx", hash],
    queryFn: () => getJson<PiTxResponse>(`/api/public/pi/transaction/${encodeURIComponent(hash)}`),
  });

  if (isLoading) return <PageLoader label="Loading Pi transaction…" />;
  if (isError || !data?.transaction) {
    return (
      <div className="space-y-4">
        <Link to="/pi/" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Pi Explorer
        </Link>
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          {error instanceof Error ? error.message : "Transaction not found"}
        </div>
      </div>
    );
  }

  const tx = data.transaction;
  const ops = data.operations ?? [];
  const horizonUrl = `${PI_TESTNET_HORIZON}/transactions/${tx.hash}`;

  return (
    <div className="space-y-6">
      <div>
        <Link to="/pi/" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Pi Testnet Explorer
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="text-xs uppercase tracking-wider text-muted-foreground">Pi Transaction</span>
          <span className="rounded-md bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-600 dark:text-amber-400">
            Testnet
          </span>
        </div>
        <div className="mt-1 flex items-start gap-2">
          <h1 className="break-all font-mono text-lg sm:text-xl">{tx.hash}</h1>
          <CopyButton value={tx.hash} />
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <StatusPill ok={tx.successful} />
          <a
            href={horizonUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            View on Horizon <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5 space-y-3 text-sm">
        <Row label="Ledger">
          <span className="font-mono">#{formatInt(tx.ledger)}</span>
        </Row>
        <Row label="Timestamp">
          <div>{fullDate(tx.created_at)}</div>
          <div className="text-xs text-muted-foreground">{timeAgo(tx.created_at)}</div>
        </Row>
        <Row label="Source account">
          <AccountLink address={tx.source_account} />
        </Row>
        <Row label="Fee charged">{formatNumber(feeInPi(tx.fee_charged))} Test-PI</Row>
        <Row label="Operations">{formatInt(tx.operation_count)}</Row>
        {tx.memo ? (
          <Row label={`Memo (${tx.memo_type || "text"})`}>
            <span className="font-mono text-xs break-all">{tx.memo}</span>
          </Row>
        ) : null}
      </div>

      <section>
        <h2 className="mb-3 text-sm font-semibold">Operations</h2>
        {ops.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
            No operations returned.
          </div>
        ) : (
          <div className="space-y-3">
            {ops.map((op) => (
              <div key={op.id} className="rounded-xl border border-border bg-card p-4 space-y-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium uppercase tracking-wider">
                    {op.type || "operation"}
                  </span>
                  <StatusPill ok={op.transaction_successful !== false} />
                  <span className="text-xs text-muted-foreground">{timeAgo(op.created_at)}</span>
                </div>
                {op.from && op.to ? (
                  <>
                    <div className="grid gap-2 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">From</div>
                        <AccountLink address={op.from} />
                      </div>
                      <ArrowRight className="hidden h-4 w-4 text-muted-foreground sm:block" />
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">To</div>
                        <AccountLink address={op.to} />
                      </div>
                    </div>
                    {op.amount ? (
                      <div className="text-lg font-semibold tabular-nums">
                        {formatNumber(op.amount)} {assetLabel(op)}
                      </div>
                    ) : null}
                  </>
                ) : null}
                <div className="text-[10px] font-mono text-muted-foreground">Op ID {op.id}</div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function AccountLink({ address }: { address: string }) {
  const isOpenPay = address === OPENPAY_TESTNET_ACCOUNT;
  return (
    <div className="flex flex-wrap items-center gap-1.5 min-w-0">
      {isOpenPay ? (
        <Link to="/pi/" className="font-mono text-xs text-primary hover:underline break-all">
          {address}
        </Link>
      ) : (
        <span className="font-mono text-xs break-all">{address}</span>
      )}
      <CopyButton value={address} />
      {isOpenPay ? (
        <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">OpenPay</span>
      ) : null}
    </div>
  );
}

function StatusPill({ ok }: { ok: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium",
        ok ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-destructive/10 text-destructive",
      )}
    >
      {ok ? "Success" : "Failed"}
    </span>
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
