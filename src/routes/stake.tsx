import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { format, subDays } from "date-fns";
import { Layers } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { StatCard } from "@/components/stat-card";
import { ChartSkeleton } from "@/components/chart-skeleton";
import { TxTable, type TxRow } from "@/components/tx-table";
import { PageLoader } from "@/components/page-loader";
import { formatInt, formatNumber, formatUsd } from "@/lib/format";
import { isStakeTx } from "@/lib/tx-classify";

export const Route = createFileRoute("/stake")({
  head: () => ({
    meta: [
      { title: "Stake — OpenLedger" },
      {
        name: "description",
        content: "OpenPay staking analytics and stake transactions on the public ledger.",
      },
    ],
  }),
  component: StakePage,
});

type StakeRow = TxRow & {
  metadata?: {
    category?: string | null;
    note?: string | null;
    event_type?: string | null;
  } | null;
};

function StakePage() {
  const since = subDays(new Date(), 30).toISOString();

  const feed = useQuery({
    queryKey: ["stake-feed"],
    queryFn: async () => {
      // Prefer typed stake rows; also pull likely legacy transfer/payment candidates.
      const [typed, legacy] = await Promise.all([
        supabase
          .from("ledger_transactions")
          .select("hash,ts,source,type,from_address,to_address,amount,currency,status,block_number,metadata")
          .eq("type", "stake")
          .order("ts", { ascending: false })
          .limit(500),
        supabase
          .from("ledger_transactions")
          .select("hash,ts,source,type,from_address,to_address,amount,currency,status,block_number,metadata")
          .in("type", ["transfer", "payment"])
          .order("ts", { ascending: false })
          .limit(2000),
      ]);

      // typed.error is ok before migration lands (unknown enum) — fall back to legacy only
      const typedRows = (!typed.error ? typed.data : null) ?? [];
      const legacyRows = (legacy.data ?? []).filter((r) => isStakeTx(r as StakeRow));

      const byHash = new Map<string, StakeRow>();
      for (const r of [...typedRows, ...legacyRows] as StakeRow[]) {
        byHash.set(r.hash, r);
      }
      return [...byHash.values()].sort((a, b) => +new Date(b.ts) - +new Date(a.ts));
    },
    refetchInterval: 20_000,
  });

  const rows = feed.data ?? [];
  const recent30 = rows.filter((r) => +new Date(r.ts) >= +new Date(since));

  const volumeAll = rows.reduce((a, r) => a + Number(r.amount ?? 0), 0);
  const volume30 = recent30.reduce((a, r) => a + Number(r.amount ?? 0), 0);
  const stakers = new Set(
    rows.flatMap((r) => [r.from_address, r.to_address].filter(Boolean) as string[]),
  ).size;
  const avgStake = rows.length ? volumeAll / rows.length : 0;

  const byCurrency = rows.reduce<Record<string, number>>((acc, r) => {
    const c = String(r.currency || "OUSD").toUpperCase();
    acc[c] = (acc[c] ?? 0) + Number(r.amount ?? 0);
    return acc;
  }, {});

  const daily = (() => {
    const map = new Map<string, { day: string; Stakes: number; Volume: number }>();
    for (let i = 29; i >= 0; i--) {
      const d = format(subDays(new Date(), i), "yyyy-MM-dd");
      map.set(d, { day: format(new Date(`${d}T00:00:00Z`), "MMM d"), Stakes: 0, Volume: 0 });
    }
    for (const r of recent30) {
      const key = String(r.ts).slice(0, 10);
      const bucket = map.get(key);
      if (!bucket) continue;
      bucket.Stakes += 1;
      bucket.Volume += Number(r.amount ?? 0);
    }
    return [...map.values()];
  })();

  const currencyBars = Object.entries(byCurrency)
    .map(([currency, volume]) => ({ currency, volume }))
    .sort((a, b) => b.volume - a.volume);

  if (feed.isLoading) return <PageLoader label="Loading stake activity…" />;

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
          <Layers className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">Stake</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Staking analytics and every stake transaction recorded on the OpenPay ledger.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Total Stakes" value={formatInt(rows.length)} sub={`${formatInt(recent30.length)} in 30d`} />
        <StatCard label="Stake Volume" value={formatNumber(volumeAll)} sub={`${formatNumber(volume30)} last 30d`} />
        <StatCard label="Unique Parties" value={formatInt(stakers)} sub="From + to addresses" />
        <StatCard label="Avg Stake Size" value={formatNumber(avgStake)} sub={formatUsd(avgStake)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-border bg-card p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Daily stake volume (30d)</h2>
            <div className="text-xs text-muted-foreground">Amount summed</div>
          </div>
          <div className="h-56 sm:h-64">
            {feed.isLoading ? (
              <ChartSkeleton />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={daily}>
                  <defs>
                    <linearGradient id="stakeVol" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="day" stroke="var(--muted-foreground)" fontSize={11} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={11} />
                  <Tooltip
                    contentStyle={{
                      background: "var(--popover)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="Volume"
                    stroke="var(--primary)"
                    fill="url(#stakeVol)"
                    strokeWidth={2}
                    isAnimationActive
                    animationDuration={800}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Daily stake count (30d)</h2>
            <div className="text-xs text-muted-foreground">Events / day</div>
          </div>
          <div className="h-56 sm:h-64">
            {feed.isLoading ? (
              <ChartSkeleton bars={12} />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={daily}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="day" stroke="var(--muted-foreground)" fontSize={11} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={11} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      background: "var(--popover)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="Stakes" fill="var(--chart-2)" radius={[4, 4, 0, 0]} isAnimationActive animationDuration={800} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>
      </div>

      {currencyBars.length > 0 ? (
        <section className="rounded-xl border border-border bg-card p-4 sm:p-5">
          <h2 className="mb-4 text-sm font-semibold">Volume by currency</h2>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={currencyBars} layout="vertical" margin={{ left: 8, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis type="number" stroke="var(--muted-foreground)" fontSize={11} />
                <YAxis type="category" dataKey="currency" stroke="var(--muted-foreground)" fontSize={11} width={56} />
                <Tooltip
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="volume" fill="var(--primary)" radius={[0, 4, 4, 0]} name="Volume" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      ) : null}

      <section>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold">Stake transactions</h2>
          <div className="text-xs text-muted-foreground">{formatInt(rows.length)} total</div>
        </div>
        <TxTable rows={rows} loading={feed.isFetching && rows.length === 0} />
      </section>
    </div>
  );
}
